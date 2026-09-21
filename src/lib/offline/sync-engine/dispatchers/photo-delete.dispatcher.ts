import { LocalOutboxQueueRecord } from "../../local-db.types";
import { MutationDispatcherResult } from "../sync-engine.types";
import { SistemaPinturaLocalDB } from "../../local-db";
import { SupabaseClientLike } from "./create-activity.dispatcher";

/**
 * Dispatcher para PHOTO_DELETE.
 *
 * Invoca a RPC public.delete_activity_photos(p_activity_id, p_photo_ids):
 * 1. Remove metadados das fotos em public.activity_photos.
 * 2. Remove arquivos físicos no Supabase Storage via storage_paths retornados pela RPC.
 * 3. Trata deleted_count = 0 como sucesso idempotente (caso a foto já tenha sido removida).
 * 4. Reconcilia o IndexedDB local.
 */
export async function dispatchPhotoDelete(
  mutation: LocalOutboxQueueRecord,
  supabase: SupabaseClientLike,
  db: SistemaPinturaLocalDB
): Promise<MutationDispatcherResult> {
  const activityId = mutation.entityId;
  const payload = mutation.payload || {};
  const photoIds = (payload.photoIds as string[]) || [];

  if (photoIds.length === 0) {
    return { success: true, idempotent: true };
  }

  // 1. Invoca RPC delete_activity_photos
  const { data, error } = await supabase.rpc("delete_activity_photos", {
    p_activity_id: activityId,
    p_photo_ids: photoIds,
  });

  if (error) {
    throw error;
  }

  const result = data as {
    success: boolean;
    deleted_count: number;
    storage_paths?: string[];
  };

  // 2. Remove arquivos físicos do Storage se houver paths retornados
  const pathsToRemove = result.storage_paths || [];
  if (pathsToRemove.length > 0 && supabase.storage) {
    try {
      await supabase.storage.from("activity-photos").remove(pathsToRemove);
    } catch {
      // Ignora erro no storage se arquivo já tiver sido removido
    }
  }

  // 3. Reconciliação local no IndexedDB
  await db.transaction("rw", [db.localPhotoBlobs, db.activities], async () => {
    for (const pid of photoIds) {
      await db.localPhotoBlobs.delete(pid);
    }

    const act = await db.activities.get(activityId);
    if (act && act.photos) {
      const removedSet = new Set(photoIds);
      await db.activities.put({
        ...act,
        photos: act.photos.filter((p) => !removedSet.has(p.id)),
        localUpdatedAt: new Date().toISOString(),
      });
    }
  });

  return {
    success: true,
    idempotent: result.deleted_count === 0,
    data: result,
  };
}
