import {
  Activity,
  ActivityHistoryEntry,
  ActivityPhotoItem,
} from "../types/activity.types";
import {
  AssignableUser,
  getAssignableUsers,
  getActivities,
  getHistoryActivities,
  getActivityById,
  createActivity,
  updateActivity,
  cancelActivity,
  archiveActivity,
  deleteActivityPermanently,
  getActivityAuditHistory,
  updateActivityProgress,
  getActivityPhotos,
  uploadActivityPhotos,
  deleteActivityPhotos,
} from "../services/activity.service";

/**
 * Contrato de repositório para o domínio de Atividades.
 * Representa estritamente operações de negócio, desacoplando a UI
 * e os hooks da tecnologia de banco de dados subjacente (Supabase).
 */
export interface IActivityRepository {
  getAssignableUsers(): Promise<AssignableUser[]>;
  getActivities(preferRealData?: boolean): Promise<Activity[]>;
  getHistoryActivities(preferRealData?: boolean): Promise<Activity[]>;
  getActivityById(activityId: string): Promise<Activity | null>;
  createActivity(activity: Activity): Promise<Activity>;
  updateActivity(activity: Activity): Promise<Activity>;
  cancelActivity(activityId: string, justification: string): Promise<Activity>;
  archiveActivity(activityId: string, reason?: string): Promise<void>;
  deleteActivityPermanently(activityId: string): Promise<void>;
  getActivityAuditHistory(activityId: string): Promise<ActivityHistoryEntry[]>;
  updateActivityProgress(
    activityId: string,
    newProgress: number,
    consumptionsList?: Array<{ materialName: string; quantity: number; unit: string }>,
    observation?: string,
    photosPayload?: { files?: File[] },
    idempotencyKey?: string
  ): Promise<Activity>;
  getActivityPhotos(activityId: string, generateSignedUrls?: boolean): Promise<ActivityPhotoItem[]>;
  uploadActivityPhotos(
    activityId: string,
    files: File[],
    observation?: string
  ): Promise<{ success: boolean; uploadedCount: number; errors?: string[] }>;
  deleteActivityPhotos(
    activityId: string,
    photoIds: string[]
  ): Promise<{ success: boolean; deletedCount: number }>;
}

import {
  cacheActivitiesLocally,
  cacheSingleActivityLocally,
  getLocalActivities,
  getLocalActivityById,
  cacheActivityAuditHistoryLocally,
  getLocalActivityAuditHistory,
  isNetworkOrOfflineError,
  isBrowserOnline,
  createOfflineActivity,
  updateOfflineActivity,
  cancelOfflineActivity,
  updateOfflineActivityProgress,
  saveOfflinePhotos,
  getOfflineActivityPhotos,
  deleteOfflinePhotos,
} from "@/lib/offline";

/**
 * Implementação do IActivityRepository com suporte a Cache Local e Leitura Offline (IndexedDB/Dexie).
 * ONLINE: busca no Supabase e atualiza o IndexedDB de forma transparente.
 * OFFLINE / ERRO DE REDE: realiza fallback para os dados previamente armazenados no IndexedDB.
 */
export class SupabaseActivityRepository implements IActivityRepository {
  async getAssignableUsers(): Promise<AssignableUser[]> {
    return getAssignableUsers();
  }

  async getActivities(preferRealData = true): Promise<Activity[]> {
    if (!isBrowserOnline()) {
      const local = await getLocalActivities();
      if (local.length > 0) return local;
    }

    try {
      const data = await getActivities(preferRealData);
      // Atualiza cache IndexedDB de forma não bloqueante
      cacheActivitiesLocally(data).catch((err) =>
        console.warn("[activityRepository] Aviso ao gravar cache local de atividades:", err)
      );
      return data;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[activityRepository] Rede indisponível. Recorrendo ao cache local de atividades.");
        const local = await getLocalActivities();
        if (local.length > 0) {
          return local;
        }
      }
      throw err;
    }
  }

  async getHistoryActivities(preferRealData = true): Promise<Activity[]> {
    if (!isBrowserOnline()) {
      const local = await getLocalActivities();
      const historyLocal = local.filter((a) => a.status === "concluida" || a.status === "cancelada");
      if (historyLocal.length > 0) return historyLocal;
    }

    try {
      const data = await getHistoryActivities(preferRealData);
      cacheActivitiesLocally(data).catch((err) =>
        console.warn("[activityRepository] Aviso ao gravar cache de histórico:", err)
      );
      return data;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[activityRepository] Rede indisponível para histórico. Recorrendo ao cache local.");
        const local = await getLocalActivities();
        const historyLocal = local.filter((a) => a.status === "concluida" || a.status === "cancelada");
        if (historyLocal.length > 0) {
          return historyLocal;
        }
      }
      throw err;
    }
  }

  async getActivityById(activityId: string): Promise<Activity | null> {
    if (!isBrowserOnline()) {
      const local = await getLocalActivityById(activityId);
      if (local) return local;
    }

    try {
      const data = await getActivityById(activityId);
      if (data) {
        cacheSingleActivityLocally(data).catch((err) =>
          console.warn("[activityRepository] Aviso ao gravar cache de atividade individual:", err)
        );
      }
      return data;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[activityRepository] Rede indisponível. Recorrendo ao cache local da atividade:", activityId);
        const local = await getLocalActivityById(activityId);
        if (local) {
          return local;
        }
      }
      throw err;
    }
  }

  async createActivity(activity: Activity): Promise<Activity> {
    if (!isBrowserOnline()) {
      return createOfflineActivity(activity);
    }

    try {
      const created = await createActivity(activity);
      cacheSingleActivityLocally({ ...created, syncStatus: "synced" }).catch(() => {});
      return created;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[activityRepository] Falha de conexão ao criar atividade. Salvando offline na Outbox.");
        return createOfflineActivity(activity);
      }
      throw err;
    }
  }

  async updateActivity(activity: Activity): Promise<Activity> {
    if (!isBrowserOnline()) {
      return updateOfflineActivity(activity);
    }

    try {
      const updated = await updateActivity(activity);
      cacheSingleActivityLocally({ ...updated, syncStatus: "synced" }).catch(() => {});
      return updated;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[activityRepository] Falha de conexão ao atualizar atividade. Salvando offline na Outbox.");
        return updateOfflineActivity(activity);
      }
      throw err;
    }
  }

  async cancelActivity(activityId: string, justification: string): Promise<Activity> {
    if (!isBrowserOnline()) {
      return cancelOfflineActivity(activityId, justification);
    }

    try {
      const cancelled = await cancelActivity(activityId, justification);
      cacheSingleActivityLocally({ ...cancelled, syncStatus: "synced" }).catch(() => {});
      return cancelled;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[activityRepository] Falha de conexão ao cancelar atividade. Salvando offline na Outbox.");
        return cancelOfflineActivity(activityId, justification);
      }
      throw err;
    }
  }

  async archiveActivity(activityId: string, reason?: string): Promise<void> {
    return archiveActivity(activityId, reason);
  }

  async deleteActivityPermanently(activityId: string): Promise<void> {
    return deleteActivityPermanently(activityId);
  }

  async getActivityAuditHistory(activityId: string): Promise<ActivityHistoryEntry[]> {
    if (!isBrowserOnline()) {
      const local = await getLocalActivityAuditHistory(activityId);
      if (local.length > 0) return local;
    }

    try {
      const data = await getActivityAuditHistory(activityId);
      cacheActivityAuditHistoryLocally(activityId, data).catch((err) =>
        console.warn("[activityRepository] Aviso ao gravar cache de auditoria:", err)
      );
      return data;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[activityRepository] Rede indisponível. Recorrendo ao cache de auditoria local:", activityId);
        const local = await getLocalActivityAuditHistory(activityId);
        if (local.length > 0) {
          return local;
        }
      }
      throw err;
    }
  }

  async updateActivityProgress(
    activityId: string,
    newProgress: number,
    consumptionsList: Array<{ materialName: string; quantity: number; unit: string }> = [],
    observation?: string,
    photosPayload?: { files?: File[] },
    idempotencyKey?: string
  ): Promise<Activity> {
    if (!isBrowserOnline()) {
      const updated = await updateOfflineActivityProgress(
        activityId,
        newProgress,
        consumptionsList,
        observation
      );
      if (photosPayload?.files && photosPayload.files.length > 0) {
        await saveOfflinePhotos(activityId, photosPayload.files, observation);
      }
      return updated;
    }

    try {
      const updated = await updateActivityProgress(
        activityId,
        newProgress,
        consumptionsList,
        observation,
        photosPayload,
        idempotencyKey
      );
      cacheSingleActivityLocally({ ...updated, syncStatus: "synced" }).catch(() => {});
      return updated;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[activityRepository] Falha de conexão ao atualizar progresso. Salvando offline na Outbox.");
        const updated = await updateOfflineActivityProgress(
          activityId,
          newProgress,
          consumptionsList,
          observation
        );
        if (photosPayload?.files && photosPayload.files.length > 0) {
          await saveOfflinePhotos(activityId, photosPayload.files, observation);
        }
        return updated;
      }
      throw err;
    }
  }

  async getActivityPhotos(activityId: string, generateSignedUrls: boolean = true): Promise<ActivityPhotoItem[]> {
    if (!isBrowserOnline()) {
      return getOfflineActivityPhotos(activityId);
    }

    try {
      const serverPhotos = await getActivityPhotos(activityId, generateSignedUrls);
      // Mescla com fotos pendentes salvas localmente offline que ainda não foram enviadas
      const localPhotos = await getOfflineActivityPhotos(activityId);
      if (localPhotos.length > 0) {
        const serverIds = new Set(serverPhotos.map((p) => p.id));
        const pendingLocal = localPhotos.filter((p) => !serverIds.has(p.id));
        return [...serverPhotos, ...pendingLocal];
      }
      return serverPhotos;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[activityRepository] Rede indisponível ao buscar fotos. Usando cache local:", activityId);
        return getOfflineActivityPhotos(activityId);
      }
      throw err;
    }
  }

  async uploadActivityPhotos(
    activityId: string,
    files: File[],
    observation?: string
  ): Promise<{ success: boolean; uploadedCount: number; errors?: string[] }> {
    if (!isBrowserOnline()) {
      return saveOfflinePhotos(activityId, files, observation);
    }

    try {
      return await uploadActivityPhotos(activityId, files, observation);
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[activityRepository] Falha de conexão ao enviar fotos. Salvando localmente no IndexedDB.");
        return saveOfflinePhotos(activityId, files, observation);
      }
      throw err;
    }
  }

  async deleteActivityPhotos(
    activityId: string,
    photoIds: string[]
  ): Promise<{ success: boolean; deletedCount: number }> {
    if (!isBrowserOnline()) {
      return deleteOfflinePhotos(activityId, photoIds);
    }

    try {
      return await deleteActivityPhotos(activityId, photoIds);
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[activityRepository] Falha de conexão ao excluir fotos. Registrando offline.");
        return deleteOfflinePhotos(activityId, photoIds);
      }
      throw err;
    }
  }
}

/**
 * Instância padrão do repositório para injeção / consumo nos hooks e componentes.
 */
export const activityRepository: IActivityRepository = new SupabaseActivityRepository();
