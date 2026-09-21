import { Activity } from "@/modules/atividades/types/activity.types";
import { Material, StockMovement } from "@/modules/materiais/types/material.types";
import { NotificationItem } from "@/modules/notificacoes/types/notification.types";
import { UserProfile } from "@/context/AuthContext";

/**
 * Status do ciclo de vida de sincronização de uma entidade no banco local e na Outbox
 */
export type LocalSyncStatus = "synced" | "pending" | "syncing" | "failed" | "conflict";

/**
 * Status de processamento de uma mutação na fila da Outbox
 */
export type OutboxMutationStatus = "pending" | "syncing" | "synced" | "failed" | "conflict";

/**
 * Operação pretendida da mutação
 */
export type OutboxOperationType =
  | "CREATE_ACTIVITY"
  | "UPDATE_ACTIVITY"
  | "CANCEL_ACTIVITY"
  | "PHOTO_ADD"
  | "PHOTO_DELETE"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "PROGRESS_UPDATE"
  | "STOCK_ENTRY";

/**
 * Entidade de Atividade Local no IndexedDB
 * Extende o modelo Activity do sistema com metadados para sincronização sem poluir o tipo original.
 */
export interface LocalActivityRecord extends Activity {
  syncStatus: LocalSyncStatus;
  localUpdatedAt: string;
  baseServerUpdatedAt?: string;
  localVersion: number;
}

/**
 * Entidade de Material Local no IndexedDB
 */
export interface LocalMaterialRecord extends Material {
  syncStatus: LocalSyncStatus;
  localUpdatedAt: string;
  baseServerUpdatedAt?: string;
}

/**
 * Entidade de Notificação Local no IndexedDB
 */
export interface LocalNotificationRecord extends NotificationItem {
  syncStatus: LocalSyncStatus;
  localUpdatedAt: string;
}

/**
 * Entidade de Log de Auditoria de Atividade Local
 */
export interface LocalActivityAuditLogRecord {
  id: string;
  activityId: string;
  userId: string;
  userName: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  oldProgress?: number;
  newProgress?: number;
  consumedMaterialsJson?: string;
  observation?: string;
  createdAt: string;
  syncStatus: LocalSyncStatus;
}

/**
 * Entidade de Movimentação de Estoque Local
 */
export interface LocalStockMovementRecord extends StockMovement {
  syncStatus: LocalSyncStatus;
  localUpdatedAt: string;
}

/**
 * Entidade para persistência segura de arquivos binários/fotos no IndexedDB
 */
export interface LocalPhotoBlobRecord {
  id: string; // UUID local da foto ou ID do Supabase
  activityId: string;
  photoRecordId?: string; // ID da sessão de registro
  blob: Blob;
  mimeType: string;
  filename: string;
  sizeBytes: number;
  storagePath?: string;
  observation?: string;
  createdAt: string;
  syncStatus: LocalSyncStatus;
}

/**
 * Contrato formal da Outbox Queue (Fila de mutações assíncronas)
 */
export interface LocalOutboxQueueRecord {
  mutationId: string; // Chave primária local (UUID)
  idempotencyKey: string; // Chave estável anti-duplicação enviada para a RPC/Backend
  clientId: string; // Identificador estável da instalação do navegador
  entityType: "activity" | "material" | "notification" | "stock" | "photo";
  entityId: string; // ID da entidade que sofreu a mutação
  operation: OutboxOperationType;
  baseVersion?: number;
  clientTimestamp: string;
  payload: Record<string, unknown>; // Snapshot dos dados da operação
  photoBlobIds?: string[]; // IDs de fotos locais vinculadas a esta mutação
  status: OutboxMutationStatus;
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}

/**
 * Cache local de autorização e perfil (sem expor credenciais)
 */
export interface LocalAuthCacheRecord {
  userId: string;
  profile: UserProfile;
  permissions: string[]; // Lista de slugs de permissão (ex: ['atividades.criar', 'materiais.editar'])
  cachedAt: string;
  expiresAt: string;
}

/**
 * Metadados globais de sincronização e integridade local
 */
export interface LocalSyncMetadataRecord {
  key: string; // Chave única (ex: 'global_sync_state')
  clientId: string; // UUID estável da instalação
  schemaVersion: number;
  lastActivitiesSync?: string;
  lastMaterialsSync?: string;
  lastNotificationsSync?: string;
  lastFullSyncAt?: string;
  updatedAt: string;
}
