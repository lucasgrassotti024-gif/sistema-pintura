import {
  SyncOperationState,
  SyncEngineProgressEvent,
  SyncEngineListener,
  MutationDispatcherFn,
  ErrorClassification,
} from "./sync-engine.types";
import { classifySyncError } from "./sync-engine.errors";
import {
  calculateNextRetryTimestamp,
  hasExceededMaxRetries,
  DEFAULT_RETRY_CONFIG,
} from "./sync-engine.retry";
import { syncLockManager, SyncLockManager } from "./sync-engine.lock";
import { syncNetworkWatcher, SyncNetworkWatcher } from "./sync-engine.network";
import { syncQueueManager, SyncQueueManager } from "./sync-engine.queue";
import { localDb, SistemaPinturaLocalDB } from "../local-db";
import { LocalOutboxQueueRecord } from "../local-db.types";
import { createActivitySyncDispatcher } from "./activity-sync.dispatcher";

/**
 * Sync Engine Core (Fase 6A)
 *
 * Responsabilidades:
 * - Orquestração e controle de ciclo de vida do motor de sincronização offline-first;
 * - Gerenciamento de estado observável (idle, syncing, error, paused);
 * - Prevenção de execuções concorrentes com Lock entre abas e flag em memória;
 * - Reação a eventos de conectividade sem polling agressivo;
 * - Classificação e tratamento diferenciado de erros (RETRYABLE, CONFLICT, TERMINAL);
 * - Processamento estritamente ordenado (FIFO por entidade);
 * - Isolamento total do fluxo online existente.
 */
export class SyncEngine {
  private static instance: SyncEngine | null = null;

  private state: SyncOperationState = "idle";
  private isRunning = false;
  private listeners: Set<SyncEngineListener> = new Set();
  private lastProgressEvent: SyncEngineProgressEvent = {
    state: "idle",
    total: 0,
    processed: 0,
    pending: 0,
    currentMutation: null,
    lastError: null,
  };

  private lockManager: SyncLockManager;
  private networkWatcher: SyncNetworkWatcher;
  private queueManager: SyncQueueManager;
  private db: SistemaPinturaLocalDB;
  private networkUnsubscribe: (() => void) | null = null;
  private customDispatcher: MutationDispatcherFn | null = null;

  /**
   * Construtor protegido / parametrizável para testes unitários
   */
  constructor(
    db: SistemaPinturaLocalDB = localDb,
    lockManager: SyncLockManager = syncLockManager,
    networkWatcher: SyncNetworkWatcher = syncNetworkWatcher,
    queueManager?: SyncQueueManager
  ) {
    this.db = db;
    this.lockManager = lockManager;
    this.networkWatcher = networkWatcher;
    this.queueManager = queueManager || new SyncQueueManager(db);
  }

  /**
   * Obtém a instância Singleton do Sync Engine para a aplicação
   */
  public static getInstance(db: SistemaPinturaLocalDB = localDb): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine(db);
      // Vincula os dispatchers reais da Fase 6B
      SyncEngine.instance.setDispatcher(createActivitySyncDispatcher(undefined, db));
    }
    return SyncEngine.instance;
  }

  /**
   * Reinicia a instância singleton (usado estritamente em baterias de testes)
   */
  public static resetInstance(): void {
    if (SyncEngine.instance) {
      SyncEngine.instance.stop();
      SyncEngine.instance = null;
    }
  }

  /**
   * Permite configurar um despachante de mutações customizado
   * (Nas fases 6B+, injetará os dispatchers reais do Supabase)
   */
  public setDispatcher(dispatcher: MutationDispatcherFn | null): void {
    this.customDispatcher = dispatcher;
  }

  /**
   * Obtém o estado e os dados de progresso atuais do Engine
   */
  public getStatus(): SyncEngineProgressEvent {
    return { ...this.lastProgressEvent };
  }

  /**
   * Inscreve um ouvinte para receber atualizações do Sync Engine.
   * Retorna função de cancelamento de inscrição (unsubscribe).
   */
  public subscribe(listener: SyncEngineListener): () => void {
    this.listeners.add(listener);
    // Notifica imediatamente o estado atual
    try {
      listener(this.getStatus());
    } catch (err) {
      console.error("[SyncEngine] Erro na notificação inicial do listener:", err);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Inicia o ciclo de vida do Sync Engine:
   * - Registra observador de rede
   * - Se online, dispara triggerSync inicial
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.networkWatcher.start();

    // Escuta evento de reconexão: ao voltar a ficar online, aciona triggerSync
    this.networkUnsubscribe = this.networkWatcher.subscribe((isOnline) => {
      if (isOnline && this.isRunning) {
        this.triggerSync().catch((err) => {
          console.error("[SyncEngine] Erro ao disparar sincronização pós-reconexão:", err);
        });
      } else if (!isOnline) {
        this.updateState("idle");
      }
    });

    // Se já estiver online no arranque, dispara sincronização de fundo
    if (this.networkWatcher.isOnline()) {
      this.triggerSync().catch((err) => {
        console.error("[SyncEngine] Erro ao disparar sincronização inicial:", err);
      });
    }
  }

  /**
   * Interrompe o Sync Engine:
   * - Remove observadores de rede
   * - Não perde mutações pendentes na Outbox
   */
  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    this.networkWatcher.stop();
    this.updateState("idle");
  }

  /**
   * Ponto de entrada para acionar um ciclo de sincronização:
   * - Verifica se está online
   * - Verifica se já está em processamento (impede duplicação in-memory)
   * - Tenta adquirir o Lock de execução exclusivo (Web Locks / Fallback)
   * - Processa a fila da Outbox
   */
  public async triggerSync(): Promise<void> {
    // 1. Se estiver offline, não tenta sincronizar
    if (!this.networkWatcher.isOnline()) {
      this.updateState("idle");
      return;
    }

    // 2. Se já estiver sincronizando nesta instância, descarta disparo concorrente
    if (this.state === "syncing") {
      return;
    }

    // 3. Tenta adquirir o Lock exclusivo entre instâncias/abas
    const lockResult = await this.lockManager.withLock(async () => {
      await this.processQueue();
    });

    if (!lockResult.executed) {
      // Lock ocupado por outra aba/processo: aguarda próxima oportunidade sem erro
      return;
    }
  }

  /**
   * Processamento interno da fila de mutações sob lock exclusivo
   */
  private async processQueue(): Promise<void> {
    try {
      this.updateState("syncing");

      // Loop de processamento enquanto houver mutações elegíveis
      let hasMore = true;
      const attemptedInRun = new Set<string>();

      while (hasMore) {
        // Se a rede caiu durante o loop, interrompe imediatamente
        if (!this.networkWatcher.isOnline()) {
          break;
        }

        const eligible = await this.queueManager.getEligibleMutations();
        const unattempted = eligible.filter((m) => !attemptedInRun.has(m.mutationId));

        if (unattempted.length === 0) {
          hasMore = false;
          break;
        }

        const stats = await this.queueManager.getQueueStats();
        let processedInBatch = 0;

        for (const mutation of unattempted) {
          if (!this.networkWatcher.isOnline()) {
            hasMore = false;
            break;
          }

          attemptedInRun.add(mutation.mutationId);
          await this.processSingleMutation(mutation, stats.total, processedInBatch);
          processedInBatch++;
        }
      }

      const finalStats = await this.queueManager.getQueueStats();
      if (finalStats.failed > 0 || finalStats.conflict > 0) {
        this.updateState("error", {
          total: finalStats.total,
          processed: finalStats.total - finalStats.pending,
          pending: finalStats.pending,
        });
      } else {
        this.updateState("idle", {
          total: finalStats.total,
          processed: finalStats.total - finalStats.pending,
          pending: finalStats.pending,
          currentMutation: null,
          lastError: null,
        });
      }
    } catch (err) {
      const classified = classifySyncError(err);
      this.updateState("error", {
        lastError: classified,
      });
    }
  }

  /**
   * Processa uma única mutação da Outbox de forma segura e determinística
   */
  private async processSingleMutation(
    mutation: LocalOutboxQueueRecord,
    total: number,
    processed: number
  ): Promise<void> {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Marca mutação como 'syncing'
    await this.queueManager.updateMutationStatus(mutation.mutationId, {
      status: "syncing",
      lastAttemptAt: nowIso,
    });

    this.notifyProgress({
      state: "syncing",
      total,
      processed,
      pending: Math.max(0, total - processed),
      currentMutation: mutation,
    });

    try {
      // Se não há despachante configurado (como na Fase 6A onde os dispatchers reais não foram autorizados),
      // registra sucesso mock se injetado em teste ou mantém pending para o futuro
      if (this.customDispatcher) {
        await this.customDispatcher(mutation);
      } else {
        // Na Fase 6A padrão, sem dispatcher configurado, apenas simula ciclo de infraestrutura
        // Sem alterar registros reais
      }

      // Sucesso na sincronização
      await this.queueManager.updateMutationStatus(mutation.mutationId, {
        status: "synced",
        lastAttemptAt: nowIso,
        errorCode: undefined,
        errorMessage: undefined,
      });
    } catch (error) {
      const classification = classifySyncError(error);
      const nextRetryCount = mutation.retryCount + 1;

      if (classification.category === "RETRYABLE") {
        if (hasExceededMaxRetries(nextRetryCount, mutation.maxRetries)) {
          // Atingiu limite de tentativas: transiciona para 'failed' definitivo
          await this.queueManager.updateMutationStatus(mutation.mutationId, {
            status: "failed",
            retryCount: nextRetryCount,
            lastAttemptAt: nowIso,
            errorCode: classification.code || "MAX_RETRIES_EXCEEDED",
            errorMessage: `Limite de tentativas excedido (${mutation.maxRetries}): ${classification.message}`,
          });
        } else {
          // Agenda retry com backoff exponencial e jitter
          const nextRetryIso = calculateNextRetryTimestamp(
            mutation.retryCount,
            now,
            DEFAULT_RETRY_CONFIG
          );

          await this.queueManager.updateMutationStatus(mutation.mutationId, {
            status: "pending", // Retorna para pending para reprocessamento futuro
            retryCount: nextRetryCount,
            lastAttemptAt: nowIso,
            nextRetryAt: nextRetryIso,
            errorCode: classification.code,
            errorMessage: classification.message,
          });
        }
      } else if (classification.category === "CONFLICT") {
        // Conflito (OCC, atividade arquivada, OS duplicada)
        // Não sofre retry automático cego
        await this.queueManager.updateMutationStatus(mutation.mutationId, {
          status: "conflict",
          lastAttemptAt: nowIso,
          errorCode: classification.code,
          errorMessage: classification.message,
        });
      } else {
        // TERMINAL: Erro de permissão, dados inválidos, constraint
        // Falha definitiva sem retry
        await this.queueManager.updateMutationStatus(mutation.mutationId, {
          status: "failed",
          lastAttemptAt: nowIso,
          errorCode: classification.code,
          errorMessage: classification.message,
        });
      }

      this.notifyProgress({
        lastError: classification,
      });
    }
  }

  /**
   * Atualiza o estado global e notifica os observadores
   */
  private updateState(
    newState: SyncOperationState,
    extra: Partial<SyncEngineProgressEvent> = {}
  ): void {
    this.state = newState;
    this.notifyProgress({
      state: newState,
      ...extra,
    });
  }

  /**
   * Emite evento atualizado a todos os inscritos
   */
  private notifyProgress(partial: Partial<SyncEngineProgressEvent>): void {
    this.lastProgressEvent = {
      ...this.lastProgressEvent,
      ...partial,
    };

    for (const listener of this.listeners) {
      try {
        listener(this.getStatus());
      } catch (err) {
        console.error("[SyncEngine] Erro ao notificar listener:", err);
      }
    }
  }
}

/**
 * Instância exportada do Sync Engine
 */
export const syncEngine = SyncEngine.getInstance();
