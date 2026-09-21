import { localDb, SistemaPinturaLocalDB } from "./local-db";
import {
  LocalActivityRecord,
  LocalMaterialRecord,
  LocalNotificationRecord,
  LocalActivityAuditLogRecord,
} from "./local-db.types";
import { updateSyncMetadata } from "./local-db.helpers";
import { Activity, ActivityHistoryEntry } from "@/modules/atividades/types/activity.types";
import { Material } from "@/modules/materiais/types/material.types";
import { NotificationItem } from "@/modules/notificacoes/types/notification.types";

/**
 * Salva uma lista de atividades recebidas do Supabase no IndexedDB.
 * Preserva o status de entidades que porventura tenham mutações locais pendentes.
 */
export async function cacheActivitiesLocally(
  activities: Activity[],
  db: SistemaPinturaLocalDB = localDb
): Promise<void> {
  if (!activities || activities.length === 0) return;

  await db.transaction("rw", [db.activities, db.outboxQueue], async () => {
    const existingIds = activities.map((a) => a.id);
    const existingRecords = await db.activities.bulkGet(existingIds);
    const existingMap = new Map(existingRecords.filter(Boolean).map((r) => [r!.id, r!]));

    // Consulta mutações pendentes na Outbox
    const pendingOutbox = await db.outboxQueue.where("entityId").anyOf(existingIds).toArray();
    const pendingEntityIds = new Set(
      pendingOutbox
        .filter((m) => m.status === "pending" || m.status === "syncing" || m.status === "conflict")
        .map((m) => m.entityId)
    );

    const recordsToPut: LocalActivityRecord[] = [];

    for (const act of activities) {
      const existing = existingMap.get(act.id);
      const isPending = pendingEntityIds.has(act.id) || existing?.syncStatus === "pending";

      if (isPending && existing) {
        // Regra Principal Fase 6E: NÃO sobrescreve a entidade local pendente!
        // Preserva o registro local integralmente
        continue;
      }

      const localVersion = (act as any).version ?? existing?.localVersion ?? 1;

      recordsToPut.push({
        ...act,
        syncStatus: "synced",
        localUpdatedAt: new Date().toISOString(),
        baseServerUpdatedAt: act.updatedAt || act.createdAt,
        localVersion,
      });
    }

    if (recordsToPut.length > 0) {
      await db.activities.bulkPut(recordsToPut);
    }
  });

  await updateSyncMetadata({ lastActivitiesSync: new Date().toISOString() }, db);
}

/**
 * Salva uma única atividade recebida do Supabase no IndexedDB.
 */
export async function cacheSingleActivityLocally(
  activity: Activity,
  db: SistemaPinturaLocalDB = localDb
): Promise<void> {
  await cacheActivitiesLocally([activity], db);
}

/**
 * Busca todas as atividades armazenadas no IndexedDB.
 */
export async function getLocalActivities(
  db: SistemaPinturaLocalDB = localDb
): Promise<Activity[]> {
  const records = await db.activities.toArray();
  return records.map((r) => {
    // Retorna a atividade preservando syncStatus para a UI
    const { localUpdatedAt, baseServerUpdatedAt, localVersion, ...activityWithSync } = r;
    return activityWithSync as Activity;
  });
}

/**
 * Busca uma atividade individual no IndexedDB.
 */
export async function getLocalActivityById(
  id: string,
  db: SistemaPinturaLocalDB = localDb
): Promise<Activity | null> {
  const record = await db.activities.get(id);
  if (!record) return null;
  const { localUpdatedAt, baseServerUpdatedAt, localVersion, ...activityWithSync } = record;
  const activity = activityWithSync as Activity;

  // Se a atividade não possuir fotos no snapshot salvo, consulta localPhotoBlobs
  if (!activity.photos || activity.photos.length === 0) {
    const blobs = await db.localPhotoBlobs.where("activityId").equals(id).toArray();
    if (blobs.length > 0) {
      activity.photos = blobs.map((b) => {
        let previewUrl: string | undefined = undefined;
        if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function" && b.blob) {
          try {
            previewUrl = URL.createObjectURL(b.blob);
          } catch {
            // fallback silencioso se não for possível gerar objectURL
          }
        }
        return {
          id: b.id,
          photoRecordId: b.photoRecordId || "",
          storagePath: b.storagePath || `local://activities/${id}/${b.id}`,
          originalFilename: b.filename,
          fileSize: b.sizeBytes,
          mimeType: b.mimeType,
          createdAt: b.createdAt,
          signedUrl: previewUrl,
          observation: b.observation,
          syncStatus: b.syncStatus || "pending",
        };
      });
    }
  }

  return activity;
}

/**
 * Salva catálogo de materiais recebidos do Supabase no IndexedDB.
 */
export async function cacheMaterialsLocally(
  materials: Material[],
  db: SistemaPinturaLocalDB = localDb
): Promise<void> {
  if (!materials || materials.length === 0) return;

  await db.transaction("rw", [db.materials, db.outboxQueue], async () => {
    const existingIds = materials.map((m) => m.id);
    const existingRecords = await db.materials.bulkGet(existingIds);
    const existingMap = new Map(existingRecords.filter(Boolean).map((r) => [r!.id, r!]));

    const pendingOutbox = await db.outboxQueue.where("entityId").anyOf(existingIds).toArray();
    const pendingEntityIds = new Set(
      pendingOutbox
        .filter((m) => m.status === "pending" || m.status === "syncing" || m.status === "conflict")
        .map((m) => m.entityId)
    );

    const recordsToPut: LocalMaterialRecord[] = [];

    for (const mat of materials) {
      const existing = existingMap.get(mat.id);
      const isPending = pendingEntityIds.has(mat.id) || existing?.syncStatus?.startsWith("pending_");

      if (isPending && existing) {
        continue;
      }

      recordsToPut.push({
        ...mat,
        syncStatus: "synced",
        localUpdatedAt: new Date().toISOString(),
        baseServerUpdatedAt: mat.updatedAt || mat.createdAt,
      });
    }

    if (recordsToPut.length > 0) {
      await db.materials.bulkPut(recordsToPut);
    }
  });

  await updateSyncMetadata({ lastMaterialsSync: new Date().toISOString() }, db);
}

/**
 * Busca todos os materiais armazenados no IndexedDB.
 */
export async function getLocalMaterials(
  db: SistemaPinturaLocalDB = localDb
): Promise<Material[]> {
  const records = await db.materials.toArray();
  return records.map((r) => {
    const { syncStatus, localUpdatedAt, baseServerUpdatedAt, ...cleanMaterial } = r;
    return cleanMaterial as Material;
  });
}

/**
 * Salva notificações recebidas do Supabase no IndexedDB.
 */
export async function cacheNotificationsLocally(
  notifications: NotificationItem[],
  db: SistemaPinturaLocalDB = localDb
): Promise<void> {
  if (!notifications || notifications.length === 0) return;

  await db.transaction("rw", db.notifications, async () => {
    const recordsToPut: LocalNotificationRecord[] = notifications.map((n) => ({
      ...n,
      syncStatus: "synced",
      localUpdatedAt: new Date().toISOString(),
    }));

    await db.notifications.bulkPut(recordsToPut);
  });

  await updateSyncMetadata({ lastNotificationsSync: new Date().toISOString() }, db);
}

/**
 * Busca todas as notificações armazenadas no IndexedDB.
 */
export async function getLocalNotifications(
  db: SistemaPinturaLocalDB = localDb
): Promise<NotificationItem[]> {
  const records = await db.notifications.orderBy("createdAt").reverse().toArray();
  return records.map((r) => {
    const { syncStatus, localUpdatedAt, ...cleanNotification } = r;
    return cleanNotification as NotificationItem;
  });
}

/**
 * Salva logs de auditoria de uma atividade no IndexedDB.
 */
export async function cacheActivityAuditHistoryLocally(
  activityId: string,
  history: ActivityHistoryEntry[],
  db: SistemaPinturaLocalDB = localDb
): Promise<void> {
  if (!history || history.length === 0) return;

  await db.transaction("rw", db.activityAuditLogs, async () => {
    const recordsToPut: LocalActivityAuditLogRecord[] = history.map((entry) => ({
      id: entry.id,
      activityId,
      userId: entry.userId,
      userName: entry.userName,
      action: entry.action,
      field: entry.field,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      oldProgress: entry.oldProgress,
      newProgress: entry.newProgress,
      consumedMaterialsJson: entry.consumedMaterials ? JSON.stringify(entry.consumedMaterials) : undefined,
      observation: entry.observation,
      createdAt: entry.timestamp,
      syncStatus: "synced",
    }));

    await db.activityAuditLogs.bulkPut(recordsToPut);
  });
}

/**
 * Busca logs de auditoria armazenados localmente para uma atividade.
 */
export async function getLocalActivityAuditHistory(
  activityId: string,
  db: SistemaPinturaLocalDB = localDb
): Promise<ActivityHistoryEntry[]> {
  const records = await db.activityAuditLogs
    .where("activityId")
    .equals(activityId)
    .reverse()
    .sortBy("createdAt");

  return records.map((r) => {
    let consumedMaterials: Array<{ materialName: string; quantity: number; unit: string }> | undefined;
    if (r.consumedMaterialsJson) {
      try {
        consumedMaterials = JSON.parse(r.consumedMaterialsJson);
      } catch {
        consumedMaterials = undefined;
      }
    }

    return {
      id: r.id,
      timestamp: r.createdAt,
      userId: r.userId,
      userName: r.userName,
      action: r.action,
      field: r.field,
      oldValue: r.oldValue,
      newValue: r.newValue,
      oldProgress: r.oldProgress,
      newProgress: r.newProgress,
      consumedMaterials,
      observation: r.observation,
    };
  });
}
