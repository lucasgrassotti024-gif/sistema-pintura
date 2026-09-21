import { LocalOutboxQueueRecord } from "../../local-db.types";
import { MutationDispatcherResult } from "../sync-engine.types";
import { SistemaPinturaLocalDB } from "../../local-db";
import { SupabaseClientLike } from "./create-activity.dispatcher";

/**
 * Dispatcher para CANCEL_ACTIVITY.
 * 
 * Invoca a RPC public.cancel_activity(p_activity_id, p_cancellation_reason, p_idempotency_key):
 * - Envia activityId (p_activity_id).
 * - Envia justificativa obrigatória (p_cancellation_reason).
 * - Envia idempotencyKey estável (p_idempotency_key).
 * - Trata resposta estruturada JSONB do PostgreSQL:
 *   - Se já cancelada, recebe {"success": true, "idempotent": true, "already_cancelled": true}.
 *   - Se concluída ou arquivada, recebe {"success": false, "conflict": true, "code": "CANNOT_CANCEL_COMPLETED"}.
 * - Reconcilia o IndexedDB local atualizando status="cancelada", syncStatus="synced" e localVersion.
 */
export async function dispatchCancelActivity(
  mutation: LocalOutboxQueueRecord,
  supabase: SupabaseClientLike,
  db: SistemaPinturaLocalDB
): Promise<MutationDispatcherResult> {
  const payload = mutation.payload || {};
  const activityId = mutation.entityId;
  const idempotencyKey = mutation.idempotencyKey;
  const cancellationReason = String(payload.cancellationReason || "").trim();

  if (!cancellationReason) {
    throw {
      code: "INVALID_DATA",
      message: "Justificativa de cancelamento obrigatória no payload da mutação.",
    };
  }

  // Invoca a RPC public.cancel_activity com 3 parâmetros
  const { data, error } = await supabase.rpc("cancel_activity", {
    p_activity_id: activityId,
    p_cancellation_reason: cancellationReason,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw error;
  }

  const result = data as {
    success?: boolean;
    conflict?: boolean;
    idempotent?: boolean;
    already_cancelled?: boolean;
    code?: string;
    message?: string;
    server_version?: number;
    activity_id?: string;
  };

  // Se o servidor retornou conflito explícito (ex: CANNOT_CANCEL_COMPLETED ou ACTIVITY_ARCHIVED)
  if (result.conflict) {
    throw {
      code: result.code || "CONFLICT",
      message: result.message || "Conflito ao cancelar atividade",
      details: result,
    };
  }

  const serverVersion = result.server_version || mutation.baseVersion || 1;

  // Reconciliação local no IndexedDB
  await db.transaction("rw", db.activities, async () => {
    const local = await db.activities.get(activityId);
    if (local) {
      await db.activities.put({
        ...local,
        status: "cancelada",
        syncStatus: "synced",
        localVersion: serverVersion,
        localUpdatedAt: new Date().toISOString(),
      });
    }
  });

  return {
    success: true,
    idempotent: Boolean(result.idempotent || result.already_cancelled),
    newVersion: serverVersion,
    data: result,
  };
}
