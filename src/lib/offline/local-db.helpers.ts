import { localDb, SistemaPinturaLocalDB, LOCAL_DB_VERSION } from "./local-db";
import {
  LocalActivityRecord,
  LocalMaterialRecord,
  LocalNotificationRecord,
  LocalPhotoBlobRecord,
  LocalOutboxQueueRecord,
  LocalAuthCacheRecord,
  LocalSyncMetadataRecord,
} from "./local-db.types";

const GLOBAL_SYNC_KEY = "global_sync_state";
const CLIENT_ID_STORAGE_KEY = "sistema_pintura_client_id";

/**
 * Retorna ou gera um clientId estável e único para o dispositivo/navegador.
 * O UUID é gerado uma única vez e armazenado de forma persistente.
 */
export function getOrCreateClientId(): string {
  if (typeof window === "undefined") {
    return "server-env-client-id";
  }

  try {
    let clientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
    }
    return clientId;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Obtém ou inicializa os metadados de sincronização do banco local.
 */
export async function getOrCreateSyncMetadata(
  db: SistemaPinturaLocalDB = localDb
): Promise<LocalSyncMetadataRecord> {
  const existing = await db.syncMetadata.get(GLOBAL_SYNC_KEY);
  if (existing) {
    return existing;
  }

  const clientId = getOrCreateClientId();
  const initial: LocalSyncMetadataRecord = {
    key: GLOBAL_SYNC_KEY,
    clientId,
    schemaVersion: LOCAL_DB_VERSION,
    updatedAt: new Date().toISOString(),
  };

  await db.syncMetadata.put(initial);
  return initial;
}

/**
 * Atualiza carimbos de sincronização de forma segura.
 */
export async function updateSyncMetadata(
  patch: Partial<Omit<LocalSyncMetadataRecord, "key" | "clientId" | "schemaVersion">>,
  db: SistemaPinturaLocalDB = localDb
): Promise<void> {
  const current = await getOrCreateSyncMetadata(db);
  await db.syncMetadata.put({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Executa uma transação atômica que grava uma atividade, opcionalmente uma mutação na outbox
 * e eventuais fotos em Blob, garantindo isolamento total (All-or-Nothing).
 */
export async function atomicSaveActivityWithOutbox(
  params: {
    activity: LocalActivityRecord;
    outboxEntry?: LocalOutboxQueueRecord;
    photoBlobs?: LocalPhotoBlobRecord[];
  },
  db: SistemaPinturaLocalDB = localDb
): Promise<void> {
  const { activity, outboxEntry, photoBlobs } = params;

  await db.transaction(
    "rw",
    [db.activities, db.outboxQueue, db.localPhotoBlobs],
    async () => {
      // 1. Grava a atividade no IndexedDB
      await db.activities.put(activity);

      // 2. Se houver fotos vinculadas, salva os blobs
      if (photoBlobs && photoBlobs.length > 0) {
        await db.localPhotoBlobs.bulkPut(photoBlobs);
      }

      // 3. Se houver registro da outbox, enfileira atomicamente
      if (outboxEntry) {
        await db.outboxQueue.put(outboxEntry);
      }
    }
  );
}

/**
 * Salva um blob de foto associado a uma atividade no banco local.
 */
export async function saveLocalPhotoBlob(
  photoRecord: LocalPhotoBlobRecord,
  db: SistemaPinturaLocalDB = localDb
): Promise<void> {
  await db.localPhotoBlobs.put(photoRecord);
}

/**
 * Recupera um blob de foto pelo ID.
 */
export async function getLocalPhotoBlob(
  id: string,
  db: SistemaPinturaLocalDB = localDb
): Promise<LocalPhotoBlobRecord | undefined> {
  return db.localPhotoBlobs.get(id);
}

/**
 * Salva ou atualiza o cache de autorização e perfil do usuário autenticado.
 */
export async function saveAuthCache(
  cache: LocalAuthCacheRecord,
  db: SistemaPinturaLocalDB = localDb
): Promise<void> {
  await db.authCache.put(cache);
}

/**
 * Recupera o cache de autenticação do usuário.
 */
export async function getAuthCache(
  userId: string,
  db: SistemaPinturaLocalDB = localDb
): Promise<LocalAuthCacheRecord | undefined> {
  return db.authCache.get(userId);
}

/**
 * Limpa todo o conteúdo do banco local (útil para logout ou reset operacional).
 */
export async function clearAllLocalData(
  db: SistemaPinturaLocalDB = localDb
): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.activities,
      db.materials,
      db.notifications,
      db.activityAuditLogs,
      db.stockMovements,
      db.localPhotoBlobs,
      db.outboxQueue,
      db.authCache,
      db.syncMetadata,
    ],
    async () => {
      await Promise.all([
        db.activities.clear(),
        db.materials.clear(),
        db.notifications.clear(),
        db.activityAuditLogs.clear(),
        db.stockMovements.clear(),
        db.localPhotoBlobs.clear(),
        db.outboxQueue.clear(),
        db.authCache.clear(),
        db.syncMetadata.clear(),
      ]);
    }
  );
}
