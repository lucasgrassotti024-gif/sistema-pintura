import { LocalOutboxQueueRecord } from "../../local-db.types";
import { MutationDispatcherResult } from "../sync-engine.types";
import { SistemaPinturaLocalDB } from "../../local-db";
import { SupabaseClientLike } from "./create-activity.dispatcher";

/**
 * Dispatcher para PROGRESS_UPDATE.
 *
 * Invoca a RPC public.update_activity_progress_and_consumption(
 *   p_activity_id,
 *   p_new_progress,
 *   p_consumptions,
 *   p_observation,
 *   p_idempotency_key
 * )
 *
 * Responsabilidades:
 * 1. Recuperar valores originais da mutation (newProgress, consumptions, observation).
 * 2. Enviar a idempotencyKey estável da mutation (reutilizada em todos os retries).
 * 3. Interpretar a resposta da RPC:
 *    - Se already_processed = true, reconcilia graciosamente sem duplicar nada;
 *    - Se sucesso, reconcilia progresso, status e consumos da atividade no IndexedDB;
 * 4. Se a RPC rejeitar por saldo insuficiente, progresso não-monotônico ou atividade cancelada:
 *    - O erro é capturado e classificado pelo Sync Engine como CONFLICT (não retentado cegamente);
 *    - Nenhuma alteração parcial de estoque ou progresso é cometida.
 */
export async function dispatchProgressConsumption(
  mutation: LocalOutboxQueueRecord,
  supabase: SupabaseClientLike,
  db: SistemaPinturaLocalDB
): Promise<MutationDispatcherResult> {
  const activityId = mutation.entityId;
  const payload = mutation.payload || {};
  const idempotencyKey = mutation.idempotencyKey;

  const newProgress = Number(payload.newProgress ?? 0);
  const consumptions = (payload.consumptions as Array<{
    custom_material_name: string;
    quantity: number;
    unit: string;
    material_id?: string;
  }>) || [];
  const observation = payload.observation ? String(payload.observation).trim() : null;

  // Invoca a RPC transacional idempotente do Supabase
  const { data, error } = await supabase.rpc(
    "update_activity_progress_and_consumption",
    {
      p_activity_id: activityId,
      p_new_progress: newProgress,
      p_consumptions: consumptions,
      p_observation: observation,
      p_idempotency_key: idempotencyKey,
    }
  );

  if (error) {
    throw error;
  }

  const result = data as {
    success: boolean;
    already_processed?: boolean;
    activity_id: string;
    order_number?: string;
    progress?: number;
    new_progress?: number;
    status?: string;
    updated_at?: string;
  };

  const confirmedProgress = result.new_progress !== undefined ? result.new_progress : (result.progress ?? newProgress);
  const confirmedStatus = (result.status as any) || (confirmedProgress >= 100 ? "concluida" : confirmedProgress > 0 ? "em_andamento" : "programada");

  // Reconciliação local no IndexedDB
  await db.transaction("rw", [db.activities], async () => {
    const local = await db.activities.get(activityId);
    if (local) {
      await db.activities.put({
        ...local,
        progressPercentage: confirmedProgress,
        status: confirmedStatus,
        syncStatus: "synced",
        localUpdatedAt: new Date().toISOString(),
      });
    }
  });

  return {
    success: true,
    idempotent: Boolean(result.already_processed),
    data: result,
  };
}
