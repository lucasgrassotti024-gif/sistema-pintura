import { localDb, SistemaPinturaLocalDB } from "./local-db";
import { LocalActivityRecord, LocalMaterialRecord, LocalNotificationRecord } from "./local-db.types";
import { Activity } from "@/modules/atividades/types/activity.types";
import { Material } from "@/modules/materiais/types/material.types";
import { NotificationItem } from "@/modules/notificacoes/types/notification.types";
import { updateSyncMetadata } from "./local-db.helpers";

/**
 * Resultado da reconciliação de um evento remoto.
 */
export interface ReconcileResult {
  applied: boolean;
  reason?: "mutation_pending" | "version_not_newer" | "not_found" | "already_synced" | "applied";
}

/**
 * Centralizador de Reconciliação Realtime e Catch-up (Fase 6E).
 *
 * Responsabilidades:
 * 1. Garantir que alterações remotas (INSERT, UPDATE, DELETE) respeitem a prioridade da Outbox;
 * 2. Impedir que eventos Realtime ou Catch-up sobrescrevam entidades com mutações locais pendentes;
 * 3. Impedir retrocesso de versão (remote version <= local version);
 * 4. Evitar condições de corrida entre Realtime e Sync Engine;
 * 5. Reconciliar materiais e estoque com autoridade do PostgreSQL;
 * 6. Evitar duplicações de notificações.
 */
export class RealtimeReconcilerService {
  private db: SistemaPinturaLocalDB;

  constructor(db: SistemaPinturaLocalDB = localDb) {
    this.db = db;
  }

  /**
   * Verifica se existe mutação pendente ou em conflito na Outbox para uma dada entidade.
   * Considera estados: 'pending', 'syncing' e 'conflict'.
   */
  public async hasPendingMutation(entityType: string, entityId: string): Promise<boolean> {
    const mutations = await this.db.outboxQueue
      .where("entityId")
      .equals(entityId)
      .toArray();

    return mutations.some((m) => {
      const matchType = m.entityType === entityType || (entityType === "activity" && m.entityType === "photo");
      const matchStatus = m.status === "pending" || m.status === "syncing" || m.status === "conflict";
      return matchType && matchStatus;
    });
  }

  // =========================================================================
  // 1. RECONCILIAÇÃO DE ATIVIDADES
  // =========================================================================

  /**
   * Reconcilia um evento INSERT ou UPDATE de atividade.
   *
   * Regras:
   * - Se houver mutation pendente na Outbox: REJEITA (preserva o estado local da UI e da Outbox);
   * - Se não houver mutation pendente:
   *   - Se for INSERT: grava no IndexedDB com syncStatus = 'synced';
   *   - Se for UPDATE: aplica apenas se remote.version > local.localVersion (evita retrocesso de versão);
   */
  public async reconcileActivityUpsert(
    remoteActivity: Activity & { version?: number },
    eventType: "INSERT" | "UPDATE"
  ): Promise<ReconcileResult> {
    const activityId = remoteActivity.id;

    // 1. Consulta Outbox para a entidade
    const pending = await this.hasPendingMutation("activity", activityId);
    if (pending) {
      // Regra Principal: Outbox tem prioridade local absoluta.
      // NÃO sobrescreve a entidade, NÃO apaga payload nem idempotencyKey.
      return { applied: false, reason: "mutation_pending" };
    }

    const remoteVersion = remoteActivity.version ?? 1;

    let applied = false;
    let reason: ReconcileResult["reason"] = "applied";

    await this.db.transaction("rw", [this.db.activities], async () => {
      const existing = await this.db.activities.get(activityId);

      if (eventType === "UPDATE" && existing) {
        const localVersion = existing.localVersion ?? 1;
        // Evita retrocesso de versão
        if (remoteVersion < localVersion) {
          reason = "version_not_newer";
          return;
        }
      }

      const recordToPut: LocalActivityRecord = {
        ...remoteActivity,
        syncStatus: "synced",
        localVersion: remoteVersion,
        localUpdatedAt: new Date().toISOString(),
        baseServerUpdatedAt: remoteActivity.updatedAt || remoteActivity.createdAt,
      };

      await this.db.activities.put(recordToPut);
      applied = true;
    });

    return { applied, reason };
  }

  /**
   * Reconcilia um evento DELETE de atividade.
   *
   * Regras:
   * - Se houver mutation pendente na Outbox: NÃO apaga a atividade nem seus blobs!
   * - Se NÃO houver mutation pendente: remove com segurança a atividade e seus blobs do IndexedDB.
   */
  public async reconcileActivityDelete(activityId: string): Promise<ReconcileResult> {
    const pending = await this.hasPendingMutation("activity", activityId);
    if (pending) {
      // Preserva entidade e blobs locais; o Sync Engine descobrirá o conflito via RPC
      return { applied: false, reason: "mutation_pending" };
    }

    await this.db.transaction(
      "rw",
      [this.db.activities, this.db.localPhotoBlobs],
      async () => {
        await this.db.activities.delete(activityId);
        await this.db.localPhotoBlobs.where("activityId").equals(activityId).delete();
      }
    );

    return { applied: true, reason: "applied" };
  }

  // =========================================================================
  // 2. RECONCILIAÇÃO DE MATERIAIS E ESTOQUE
  // =========================================================================

  /**
   * Reconcilia alterações de materiais e estoque.
   *
   * Regras:
   * - O servidor PostgreSQL é a única autoridade de estoque;
   * - Se houver mutation pendente para o material: preserva alteração local pendente;
   * - Se não houver mutation pendente: atualiza o saldo e metadados no IndexedDB.
   */
  public async reconcileMaterialUpsert(
    remoteMaterial: Material,
    _eventType: "INSERT" | "UPDATE"
  ): Promise<ReconcileResult> {
    const materialId = remoteMaterial.id;

    const pending = await this.hasPendingMutation("material", materialId);
    if (pending) {
      return { applied: false, reason: "mutation_pending" };
    }

    await this.db.transaction("rw", [this.db.materials], async () => {
      const recordToPut: LocalMaterialRecord = {
        ...remoteMaterial,
        syncStatus: "synced",
        localUpdatedAt: new Date().toISOString(),
        baseServerUpdatedAt: remoteMaterial.updatedAt || remoteMaterial.createdAt,
      };

      await this.db.materials.put(recordToPut);
    });

    return { applied: true, reason: "applied" };
  }

  /**
   * Reconcilia exclusão de material.
   */
  public async reconcileMaterialDelete(materialId: string): Promise<ReconcileResult> {
    const pending = await this.hasPendingMutation("material", materialId);
    if (pending) {
      return { applied: false, reason: "mutation_pending" };
    }

    await this.db.materials.delete(materialId);
    return { applied: true, reason: "applied" };
  }

  // =========================================================================
  // 3. RECONCILIAÇÃO DE NOTIFICAÇÕES
  // =========================================================================

  /**
   * Reconcilia inserção ou atualização de notificação.
   * Garante que não haja duplicatas utilizando a chave primária id.
   */
  public async reconcileNotificationUpsert(
    notification: NotificationItem
  ): Promise<ReconcileResult> {
    await this.db.transaction("rw", [this.db.notifications], async () => {
      const existing = await this.db.notifications.get(notification.id);
      const recordToPut: LocalNotificationRecord = {
        ...notification,
        read: notification.read ?? existing?.read ?? false,
        readAt: notification.readAt ?? existing?.readAt ?? null,
        syncStatus: "synced",
        localUpdatedAt: new Date().toISOString(),
      };

      await this.db.notifications.put(recordToPut);
    });

    return { applied: true, reason: "applied" };
  }

  /**
   * Reconcilia exclusão de notificação.
   */
  public async reconcileNotificationDelete(notificationId: string): Promise<ReconcileResult> {
    await this.db.notifications.delete(notificationId);
    return { applied: true, reason: "applied" };
  }

  /**
   * Reconcilia alteração no status de leitura (INSERT / DELETE em public.notification_reads).
   */
  public async reconcileNotificationReadStatus(
    notificationId: string,
    read: boolean,
    readAt: string | null = null
  ): Promise<ReconcileResult> {
    let applied = false;
    await this.db.transaction("rw", [this.db.notifications], async () => {
      const existing = await this.db.notifications.get(notificationId);
      if (existing) {
        await this.db.notifications.update(notificationId, {
          read,
          readAt: read ? (readAt || new Date().toISOString()) : null,
          localUpdatedAt: new Date().toISOString(),
        });
        applied = true;
      }
    });

    return { applied, reason: applied ? "applied" : "not_found" };
  }
}

export const realtimeReconciler = new RealtimeReconcilerService();
