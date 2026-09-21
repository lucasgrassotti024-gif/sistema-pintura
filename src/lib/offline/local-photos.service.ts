import { localDb, SistemaPinturaLocalDB } from "./local-db";
import {
  LocalPhotoBlobRecord,
  LocalOutboxQueueRecord,
} from "./local-db.types";
import { getOrCreateClientId } from "./local-db.helpers";
import { ActivityPhotoItem } from "@/modules/atividades/types/activity.types";
import { outboxNotifier } from "./outbox-notifier";

export interface SaveOfflinePhotosResult {
  success: boolean;
  uploadedCount: number;
  photoIds: string[];
  errors?: string[];
}

export interface DeleteOfflinePhotosResult {
  success: boolean;
  deletedCount: number;
}

/**
 * Salva fotos físicas localmente no IndexedDB (localPhotoBlobs) com UUID v4 estável,
 * validações de formato e tamanho (máx 5MB) e enfileira metadados na OutboxQueue.
 * IMPORTANTE: Nunca coloca Blob dentro do payload da Outbox.
 */
export async function saveOfflinePhotos(
  activityId: string,
  files: File[],
  observation?: string,
  db: SistemaPinturaLocalDB = localDb
): Promise<SaveOfflinePhotosResult> {
  if (!activityId) {
    throw new Error("ID da atividade é obrigatório para salvar fotos offline.");
  }

  if (!files || files.length === 0) {
    return { success: true, uploadedCount: 0, photoIds: [] };
  }

  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  const maxSizeBytes = 5242880; // 5 MB

  const photoBlobsToInsert: LocalPhotoBlobRecord[] = [];
  const generatedPhotoIds: string[] = [];
  const now = new Date().toISOString();

  // Sessão local estável para compatibilidade com schema de photoRecordId
  const localPhotoRecordId = crypto.randomUUID();

  for (const file of files) {
    if (file.size > maxSizeBytes) {
      throw new Error(`O arquivo "${file.name}" excede o limite máximo permitido de 5 MB.`);
    }
    if (!allowedMimes.includes(file.type)) {
      throw new Error(`O arquivo "${file.name}" possui formato inválido. Permitido: JPG, PNG, WEBP.`);
    }

    const photoId = crypto.randomUUID();
    generatedPhotoIds.push(photoId);

    const blobRecord: LocalPhotoBlobRecord = {
      id: photoId,
      activityId,
      photoRecordId: localPhotoRecordId,
      blob: file,
      mimeType: file.type || "image/jpeg",
      filename: file.name,
      sizeBytes: file.size,
      observation: observation?.trim() || undefined,
      createdAt: now,
      syncStatus: "pending",
    };

    photoBlobsToInsert.push(blobRecord);
  }

  const clientId = getOrCreateClientId();
  const mutationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();

  // A Outbox contém APENAS metadados e referências de IDs. NUNCA Blobs ou Files.
  const payload: Record<string, unknown> = {
    activityId,
    photoRecordId: localPhotoRecordId,
    observation: observation?.trim() || undefined,
    photoMetas: photoBlobsToInsert.map((p) => ({
      id: p.id,
      filename: p.filename,
      mimeType: p.mimeType,
      sizeBytes: p.sizeBytes,
      createdAt: p.createdAt,
    })),
  };

  const outboxEntry: LocalOutboxQueueRecord = {
    mutationId,
    idempotencyKey,
    clientId,
    entityType: "photo",
    entityId: activityId,
    operation: "PHOTO_ADD",
    clientTimestamp: now,
    payload,
    photoBlobIds: generatedPhotoIds,
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: now,
  };

  // Transação Atômica Dexie: Salva Blobs físicos + Registra Outbox
  await db.transaction("rw", [db.localPhotoBlobs, db.outboxQueue], async () => {
    await db.localPhotoBlobs.bulkPut(photoBlobsToInsert);
    await db.outboxQueue.put(outboxEntry);
  });

  outboxNotifier.notify({
    type: "enqueued",
    entityType: "photo",
    entityId: activityId,
    mutationId,
    timestamp: now,
  });

  return {
    success: true,
    uploadedCount: photoBlobsToInsert.length,
    photoIds: generatedPhotoIds,
  };
}

/**
 * Consulta fotos locais no IndexedDB para uma atividade e gera Object URLs para visualização imediata.
 */
export async function getOfflineActivityPhotos(
  activityId: string,
  db: SistemaPinturaLocalDB = localDb
): Promise<ActivityPhotoItem[]> {
  if (!activityId) return [];

  const records = await db.localPhotoBlobs
    .where("activityId")
    .equals(activityId)
    .toArray();

  if (!records || records.length === 0) return [];

  // Mapeia para ActivityPhotoItem gerando Object URL seguro a partir do Blob local
  return records.map((record) => {
    let previewUrl: string | undefined = undefined;
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function" && record.blob) {
      try {
        previewUrl = URL.createObjectURL(record.blob);
      } catch (err) {
        console.warn("[getOfflineActivityPhotos] Falha ao criar ObjectURL do blob local:", err);
      }
    }

    return {
      id: record.id,
      photoRecordId: record.photoRecordId || "",
      storagePath: record.storagePath || `local://activities/${activityId}/${record.id}`,
      originalFilename: record.filename,
      fileSize: record.sizeBytes,
      mimeType: record.mimeType,
      createdAt: record.createdAt,
      signedUrl: previewUrl,
      observation: record.observation,
      syncStatus: record.syncStatus || "pending",
    };
  });
}

/**
 * Remove fotos de uma atividade em modo offline.
 * - Se a foto possui syncStatus = "pending" (criada localmente offline e nunca sincronizada):
 *   Remove o Blob físico de localPhotoBlobs e atualiza as entradas da OutboxQueue.
 * - Se a foto já foi sincronizada anteriormente (ou veio do servidor):
 *   Registra uma intenção de exclusão na Outbox sem tentar chamada remota.
 */
export async function deleteOfflinePhotos(
  activityId: string,
  photoIds: string[],
  db: SistemaPinturaLocalDB = localDb
): Promise<DeleteOfflinePhotosResult> {
  if (!activityId || !photoIds || photoIds.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  const clientId = getOrCreateClientId();
  const now = new Date().toISOString();
  let deletedCount = 0;

  await db.transaction("rw", [db.localPhotoBlobs, db.outboxQueue], async () => {
    for (const photoId of photoIds) {
      const existing = await db.localPhotoBlobs.get(photoId);

      if (existing) {
        if (existing.syncStatus === "pending") {
          // Foto puramente local não enviada ao servidor: exclusão física imediata
          await db.localPhotoBlobs.delete(photoId);
          deletedCount++;

          // Remove photoId de referências na outboxQueue se existir
          const outboxEntries = await db.outboxQueue
            .where("entityId")
            .equals(activityId)
            .toArray();

          for (const entry of outboxEntries) {
            if (entry.photoBlobIds?.includes(photoId)) {
              const updatedPhotoIds = entry.photoBlobIds.filter((id) => id !== photoId);
              if (updatedPhotoIds.length === 0 && entry.entityType === "photo") {
                // Se era uma mutação exclusiva dessas fotos e não sobrou nenhuma, remove da fila
                await db.outboxQueue.delete(entry.mutationId);
              } else {
                await db.outboxQueue.update(entry.mutationId, {
                  photoBlobIds: updatedPhotoIds,
                });
              }
            }
          }
        } else {
          // Foto já sincronizada: marca remoção local e registra intenção na outbox
          await db.localPhotoBlobs.delete(photoId);
          deletedCount++;

          const mutationId = crypto.randomUUID();
          const idempotencyKey = crypto.randomUUID();

          const deleteEntry: LocalOutboxQueueRecord = {
            mutationId,
            idempotencyKey,
            clientId,
            entityType: "photo",
            entityId: activityId,
            operation: "PHOTO_DELETE",
            clientTimestamp: now,
            payload: {
              activityId,
              photoIds: [photoId],
            },
            status: "pending",
            retryCount: 0,
            maxRetries: 5,
            createdAt: now,
          };

          await db.outboxQueue.put(deleteEntry);
        }
      } else {
        // Foto não estava em localPhotoBlobs (ex: carregada remotamente e não persistida localmente)
        deletedCount++;
        const mutationId = crypto.randomUUID();
        const idempotencyKey = crypto.randomUUID();

        const deleteEntry: LocalOutboxQueueRecord = {
          mutationId,
          idempotencyKey,
          clientId,
          entityType: "photo",
          entityId: activityId,
          operation: "PHOTO_DELETE",
          clientTimestamp: now,
          payload: {
            activityId,
            photoIds: [photoId],
          },
          status: "pending",
          retryCount: 0,
          maxRetries: 5,
          createdAt: now,
        };

        await db.outboxQueue.put(deleteEntry);
      }
    }
  });

  return { success: true, deletedCount };
}
