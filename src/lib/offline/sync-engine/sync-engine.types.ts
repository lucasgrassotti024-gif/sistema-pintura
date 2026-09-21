import { LocalOutboxQueueRecord } from "../local-db.types";

/**
 * Estados do ciclo de vida operacional do Sync Engine
 */
export type SyncOperationState = "idle" | "syncing" | "error" | "paused";

/**
 * Categorias formais de classificação de erros do Sync Engine
 */
export type SyncErrorCategory = "RETRYABLE" | "TERMINAL" | "CONFLICT";

/**
 * Estrutura de classificação detalhada de erros retornada pelo classificador
 */
export interface ErrorClassification {
  category: SyncErrorCategory;
  code?: string;
  message: string;
  statusCode?: number;
  originalError: unknown;
}

/**
 * Evento emitido aos observadores do Sync Engine
 */
export interface SyncEngineProgressEvent {
  state: SyncOperationState;
  total: number;
  processed: number;
  pending: number;
  currentMutation?: LocalOutboxQueueRecord | null;
  lastError?: ErrorClassification | null;
}

/**
 * Assinatura do listener de eventos do Sync Engine
 */
export type SyncEngineListener = (event: SyncEngineProgressEvent) => void;

/**
 * Interface futura do dispatcher para mutações individuais
 * (Será implementado nas fases 6B+)
 */
export interface MutationDispatcherResult {
  success: boolean;
  idempotent?: boolean;
  newVersion?: number;
  data?: unknown;
}

export type MutationDispatcherFn = (
  mutation: LocalOutboxQueueRecord
) => Promise<MutationDispatcherResult>;
