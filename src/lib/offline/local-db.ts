import Dexie, { type EntityTable } from "dexie";
import {
  LocalActivityRecord,
  LocalMaterialRecord,
  LocalNotificationRecord,
  LocalActivityAuditLogRecord,
  LocalStockMovementRecord,
  LocalPhotoBlobRecord,
  LocalOutboxQueueRecord,
  LocalAuthCacheRecord,
  LocalSyncMetadataRecord,
} from "./local-db.types";

/**
 * Versão atual do banco local IndexedDB
 */
export const LOCAL_DB_VERSION = 1;
export const LOCAL_DB_NAME = "SistemaPinturaLocalDB";

/**
 * Instância centralizada do banco local baseada em Dexie.js
 */
export class SistemaPinturaLocalDB extends Dexie {
  // Tabelas tipadas com EntityTable
  activities!: EntityTable<LocalActivityRecord, "id">;
  materials!: EntityTable<LocalMaterialRecord, "id">;
  notifications!: EntityTable<LocalNotificationRecord, "id">;
  activityAuditLogs!: EntityTable<LocalActivityAuditLogRecord, "id">;
  stockMovements!: EntityTable<LocalStockMovementRecord, "id">;
  localPhotoBlobs!: EntityTable<LocalPhotoBlobRecord, "id">;
  outboxQueue!: EntityTable<LocalOutboxQueueRecord, "mutationId">;
  authCache!: EntityTable<LocalAuthCacheRecord, "userId">;
  syncMetadata!: EntityTable<LocalSyncMetadataRecord, "key">;

  constructor(dbName: string = LOCAL_DB_NAME) {
    super(dbName);

    // =========================================================================
    // VERSIONAMENTO DO SCHEMA LOCAL
    // =========================================================================
    // Versão 1: Fundação do banco local com 9 tabelas e índices otimizados.
    // Futuras migrações locais devem ser declaradas incrementando a versão:
    // Exemplo: this.version(2).stores({...}).upgrade(tx => {...})
    // =========================================================================
    this.version(1).stores({
      activities: "id, orderNumber, status, syncStatus, updatedAt, localUpdatedAt",
      materials: "id, code, type, active, syncStatus, localUpdatedAt",
      notifications: "id, read, category, severity, createdAt, syncStatus",
      activityAuditLogs: "id, activityId, userId, createdAt, syncStatus",
      stockMovements: "id, materialId, movementType, createdAt, syncStatus",
      localPhotoBlobs: "id, activityId, photoRecordId, syncStatus, createdAt",
      outboxQueue: "mutationId, idempotencyKey, entityType, entityId, status, createdAt, nextRetryAt",
      authCache: "userId, cachedAt, expiresAt",
      syncMetadata: "key, clientId, updatedAt",
    });
  }
}

/**
 * Singleton padrão da aplicação
 */
export const localDb = new SistemaPinturaLocalDB();
