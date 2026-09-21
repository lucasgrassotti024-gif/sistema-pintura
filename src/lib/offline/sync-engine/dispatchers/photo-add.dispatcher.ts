import { LocalOutboxQueueRecord, LocalPhotoBlobRecord } from "../../local-db.types";
import { MutationDispatcherResult } from "../sync-engine.types";
import { SistemaPinturaLocalDB } from "../../local-db";
import { SupabaseClientLike } from "./create-activity.dispatcher";

/**
 * Dispatcher para PHOTO_ADD.
 *
 * Responsabilidades:
 * 1. Validar que a atividade correspondente já existe e está confirmada/sincronizada (não pendente).
 *    Se a atividade ainda estiver pendente, adia a sincronização sem erro.
 * 2. Se a atividade falhou ou entrou em conflito terminal, a foto não pode gerar upload órfão.
 * 3. Recuperar os Blobs locais do IndexedDB (localPhotoBlobs) vinculados à mutação.
 * 4. Iniciar ou reaproveitar sessão de fotos no Supabase via start_photo_record_session(p_activity_id, p_observation, p_photo_record_id).
 * 5. Fazer upload para o bucket 'activity-photos' no caminho padrão:
 *    activities/{activityId}/{photoRecordId}/{photoId}.{ext}
 * 6. Confirmar a sessão via confirm_photo_record_session(p_photo_record_id, p_photos).
 * 7. Tratamento de falhas parciais com rollback seguro e preservação do Blob local.
 * 8. SOMENTE após confirmação remota com sucesso:
 *    - Remove os Blobs físicos de localPhotoBlobs;
 *    - Atualiza syncStatus para 'synced';
 *    - Reconcilia a atividade local.
 */
export async function dispatchPhotoAdd(
  mutation: LocalOutboxQueueRecord,
  supabase: SupabaseClientLike,
  db: SistemaPinturaLocalDB
): Promise<MutationDispatcherResult> {
  const activityId = mutation.entityId;
  const payload = mutation.payload || {};
  const photoRecordId = String(payload.photoRecordId || mutation.idempotencyKey);
  const observation = payload.observation ? String(payload.observation).trim() : undefined;

  // -------------------------------------------------------------------------
  // 1. Verificar dependência da Atividade
  // -------------------------------------------------------------------------
  // A foto pertence a uma atividade. Se houver uma mutação CREATE_ACTIVITY pendente
  // para essa atividade na Outbox, a foto deve aguardar a confirmação da atividade.
  const activityMutations = await db.outboxQueue
    .where("entityId")
    .equals(activityId)
    .toArray();

  const pendingCreate = activityMutations.find(
    (m) => m.operation === "CREATE_ACTIVITY" && m.status === "pending"
  );
  if (pendingCreate) {
    // A atividade ainda está pendente de sincronização.
    // Lança erro retryable controlado para aguardar o ciclo da atividade
    throw {
      category: "RETRYABLE",
      code: "ACTIVITY_SYNC_PENDING",
      message: `Aguardando sincronização da atividade principal (${activityId}) antes do upload das fotos.`,
    };
  }

  const failedCreate = activityMutations.find(
    (m) => m.operation === "CREATE_ACTIVITY" && (m.status === "failed" || m.status === "conflict")
  );
  if (failedCreate) {
    // Se a criação da atividade falhou terminalmente ou está em conflito, não faz upload de fotos órfãs
    throw {
      category: "CONFLICT",
      code: "PARENT_ACTIVITY_BLOCKED",
      message: `Criação da atividade principal em estado ${failedCreate.status}. Upload de fotos bloqueado.`,
    };
  }

  // Verifica se a atividade existe localmente
  const localAct = await db.activities.get(activityId);
  if (!localAct) {
    throw {
      category: "TERMINAL",
      code: "ACTIVITY_NOT_FOUND",
      message: `Atividade (${activityId}) não encontrada no banco local.`,
    };
  }

  // -------------------------------------------------------------------------
  // 2. Localizar Blobs Locais
  // -------------------------------------------------------------------------
  const photoBlobIds = mutation.photoBlobIds || [];
  if (photoBlobIds.length === 0) {
    // Nada a enviar
    return { success: true, idempotent: true };
  }

  const blobRecords: LocalPhotoBlobRecord[] = [];
  for (const pid of photoBlobIds) {
    const rec = await db.localPhotoBlobs.get(pid);
    if (rec && rec.blob) {
      blobRecords.push(rec);
    }
  }

  // Se todos os Blobs já foram removidos (ex: confirmação prévia em retry), considera já sincronizado
  if (blobRecords.length === 0) {
    return {
      success: true,
      idempotent: true,
      data: { message: "Blobs locais já processados e removidos anteriormente." },
    };
  }

  // -------------------------------------------------------------------------
  // 3. Iniciar ou Reutilizar Sessão no Supabase (Migration 33)
  // -------------------------------------------------------------------------
  const { data: sessionData, error: sessionErr } = await supabase.rpc(
    "start_photo_record_session",
    {
      p_activity_id: activityId,
      p_observation: observation || null,
      p_photo_record_id: photoRecordId,
    }
  );

  if (sessionErr) {
    throw sessionErr;
  }

  const sessionResult = sessionData as {
    photo_record_id: string;
    activity_id: string;
    status: string;
    idempotent?: boolean;
    reused?: boolean;
  };

  const effectiveRecordId = sessionResult.photo_record_id || photoRecordId;

  // Se a sessão já estiver confirmada remotamente (ex: retry após confirmação bem-sucedida)
  if (sessionResult.status === "confirmado") {
    // Remove os Blobs locais com segurança e finaliza
    await db.transaction("rw", [db.localPhotoBlobs, db.activities], async () => {
      for (const b of blobRecords) {
        await db.localPhotoBlobs.delete(b.id);
      }
    });

    return {
      success: true,
      idempotent: true,
      data: sessionResult,
    };
  }

  // -------------------------------------------------------------------------
  // 4. Upload dos Arquivos no Supabase Storage
  // -------------------------------------------------------------------------
  const uploadedPhotos: Array<{
    storage_path: string;
    original_filename: string;
    file_size: number;
    mime_type: string;
  }> = [];
  const uploadedPaths: string[] = [];

  if (!supabase.storage) {
    throw {
      category: "TERMINAL",
      code: "STORAGE_NOT_CONFIGURED",
      message: "Cliente de armazenamento (Storage) não configurado no cliente Supabase.",
    };
  }

  try {
    for (const record of blobRecords) {
      const ext = record.filename.split(".").pop()?.toLowerCase() || 
        (record.mimeType === "image/png" ? "png" : record.mimeType === "image/webp" ? "webp" : "jpg");
      
      const storagePath = `activities/${activityId}/${effectiveRecordId}/${record.id}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("activity-photos")
        .upload(storagePath, record.blob, {
          contentType: record.mimeType || "image/jpeg",
          upsert: true, // Idempotente para retries
        });

      if (uploadErr) {
        throw uploadErr;
      }

      uploadedPaths.push(storagePath);
      uploadedPhotos.push({
        storage_path: storagePath,
        original_filename: record.filename,
        file_size: record.sizeBytes,
        mime_type: record.mimeType,
      });
    }

    // -------------------------------------------------------------------------
    // 5. Confirmar a Sessão no Banco (Migration 12)
    // -------------------------------------------------------------------------
    const { data: confirmData, error: confirmErr } = await supabase.rpc(
      "confirm_photo_record_session",
      {
        p_photo_record_id: effectiveRecordId,
        p_photos: uploadedPhotos,
      }
    );

    if (confirmErr) {
      throw confirmErr;
    }

    // -------------------------------------------------------------------------
    // 6. Sucesso Confirmado: Reconciliar IndexedDB e Remover Blobs Locais
    // -------------------------------------------------------------------------
    await db.transaction("rw", [db.localPhotoBlobs, db.activities], async () => {
      for (const b of blobRecords) {
        await db.localPhotoBlobs.delete(b.id);
      }

      const act = await db.activities.get(activityId);
      if (act) {
        // Atualiza a lista de fotos da atividade local com metadados confirmados
        const newPhotoItems = uploadedPhotos.map((p, idx) => ({
          id: blobRecords[idx]?.id || crypto.randomUUID(),
          photoRecordId: effectiveRecordId,
          storagePath: p.storage_path,
          originalFilename: p.original_filename,
          fileSize: p.file_size,
          mimeType: p.mime_type,
          createdAt: new Date().toISOString(),
          observation,
        }));

        const existingPhotos = act.photos || [];
        // Filtra fotos locais temporárias que foram confirmadas
        const confirmedIds = new Set(blobRecords.map((b) => b.id));
        const filtered = existingPhotos.filter((p) => !confirmedIds.has(p.id));

        await db.activities.put({
          ...act,
          photos: [...filtered, ...newPhotoItems],
          localUpdatedAt: new Date().toISOString(),
        });
      }
    });

    return {
      success: true,
      idempotent: false,
      data: confirmData,
    };
  } catch (error) {
    // -------------------------------------------------------------------------
    // 7. Tratamento de Falha Parcial: Preservação do Blob Local
    // -------------------------------------------------------------------------
    // NÃO apaga os Blobs locais; eles continuam persistidos para o próximo retry.
    // Tenta abortar a sessão pendente se confirm_photo_record_session ainda não rodou
    try {
      if (sessionResult.status === "pendente") {
        await supabase.rpc("abort_photo_record_session", {
          p_photo_record_id: effectiveRecordId,
        });
      }
    } catch {
      // Falha silenciosa no abort, pois pode estar offline
    }

    throw error;
  }
}
