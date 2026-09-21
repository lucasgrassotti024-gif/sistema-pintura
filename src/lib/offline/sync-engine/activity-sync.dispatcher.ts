import { createClient } from "@/lib/supabase/client";
import { LocalOutboxQueueRecord } from "../local-db.types";
import { MutationDispatcherResult } from "./sync-engine.types";
import { localDb, SistemaPinturaLocalDB } from "../local-db";
import { dispatchCreateActivity, SupabaseClientLike } from "./dispatchers/create-activity.dispatcher";
import { dispatchUpdateActivity } from "./dispatchers/update-activity.dispatcher";
import { dispatchCancelActivity } from "./dispatchers/cancel-activity.dispatcher";
import { dispatchPhotoAdd } from "./dispatchers/photo-add.dispatcher";
import { dispatchPhotoDelete } from "./dispatchers/photo-delete.dispatcher";
import { dispatchProgressConsumption } from "./dispatchers/progress-consumption.dispatcher";

export * from "./dispatchers/create-activity.dispatcher";
export * from "./dispatchers/update-activity.dispatcher";
export * from "./dispatchers/cancel-activity.dispatcher";
export * from "./dispatchers/photo-add.dispatcher";
export * from "./dispatchers/photo-delete.dispatcher";
export * from "./dispatchers/progress-consumption.dispatcher";

/**
 * Cria o dispatcher principal de atividades, fotos e progresso/consumo, roteando por tipo de operação da Outbox:
 * - CREATE_ACTIVITY
 * - UPDATE_ACTIVITY
 * - CANCEL_ACTIVITY
 * - PHOTO_ADD
 * - PHOTO_DELETE
 * - PROGRESS_UPDATE
 *
 * @param supabase Cliente Supabase opcional (injeção para testes ou uso padrão de produção)
 * @param db Instância IndexedDB Dexie opcional
 */
export function createActivitySyncDispatcher(
  supabase?: SupabaseClientLike,
  db: SistemaPinturaLocalDB = localDb
) {
  return async function activitySyncDispatcher(
    mutation: LocalOutboxQueueRecord
  ): Promise<MutationDispatcherResult> {
    const client = supabase || createClient();

    switch (mutation.operation) {
      case "CREATE_ACTIVITY":
        return dispatchCreateActivity(mutation, client, db);

      case "UPDATE_ACTIVITY":
        return dispatchUpdateActivity(mutation, client, db);

      case "CANCEL_ACTIVITY":
        return dispatchCancelActivity(mutation, client, db);

      case "PHOTO_ADD":
        return dispatchPhotoAdd(mutation, client, db);

      case "PHOTO_DELETE":
        return dispatchPhotoDelete(mutation, client, db);

      case "PROGRESS_UPDATE":
        return dispatchProgressConsumption(mutation, client, db);

      default:
        // Se for outra operação não pertencente ao escopo de atividades/fotos/progresso das Fases 6A-6D
        // (como STOCK_ENTRY futuramente), ignora graciosamente
        return {
          success: true,
          data: { skipped: true, reason: `Operação ${mutation.operation} não tratada na Fase 6D` },
        };
    }
  };
}
