import { useState, useEffect, useCallback, useRef } from "react";
import {
  syncEngine,
  syncQueueManager,
  isBrowserOnline,
  getOrCreateSyncMetadata,
  LocalOutboxQueueRecord,
  SyncOperationState,
  ErrorClassification,
} from "@/lib/offline";
import { outboxNotifier } from "@/lib/offline/outbox-notifier";

/**
 * Estados visuais normalizados e priorizados para a UI do operador
 */
export type NormalizedSyncVisualState =
  | "CONFLICT"
  | "ERROR"
  | "SYNCING"
  | "PENDING"
  | "OFFLINE"
  | "SYNCED";

/**
 * Função pura de derivação de estado visual normalizado
 * Prioridade estrita:
 * 1. CONFLICT (conflitos precisam de atenção imediata)
 * 2. ERROR (erros terminais / falhas irrecuperáveis)
 * 3. SYNCING (sincronização ativa no momento)
 * 4. PENDING (mutações salvas localmente aguardando envio)
 * 5. OFFLINE (sem conexão de rede)
 * 6. SYNCED (tudo limpo e conectado)
 */
export function deriveNormalizedSyncState(params: {
  isOnline: boolean;
  state: SyncOperationState;
  pendingCount: number;
  conflictCount: number;
  failedCount: number;
}): NormalizedSyncVisualState {
  const { isOnline, state, pendingCount, conflictCount, failedCount } = params;

  if (conflictCount > 0) {
    return "CONFLICT";
  }

  if (failedCount > 0) {
    return "ERROR";
  }

  if (isOnline && state === "syncing") {
    return "SYNCING";
  }

  if (isOnline && pendingCount > 0) {
    return "PENDING";
  }

  if (!isOnline) {
    return "OFFLINE";
  }

  return "SYNCED";
}

export interface UseSyncStatusResult {
  isOnline: boolean;
  state: SyncOperationState;
  visualState: NormalizedSyncVisualState;
  pendingCount: number;
  conflictCount: number;
  failedCount: number;
  totalCount: number;
  processedCount: number;
  currentMutation: LocalOutboxQueueRecord | null;
  lastError: ErrorClassification | null;
  lastSyncTime: string | null;
  triggerSync: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

/**
 * Hook React que integra o Sync Engine, o SyncQueueManager, o detector de rede
 * e o notificador da Outbox para fornecer uma visão completa, reativa e em tempo
 * real do estado de sincronização offline-first.
 */
export function useSyncStatus(): UseSyncStatusResult {
  const [isOnline, setIsOnline] = useState<boolean>(() => isBrowserOnline());
  const [engineState, setEngineState] = useState<SyncOperationState>(() => syncEngine.getStatus().state);
  const [currentMutation, setCurrentMutation] = useState<LocalOutboxQueueRecord | null>(
    () => syncEngine.getStatus().currentMutation || null
  );
  const [lastError, setLastError] = useState<ErrorClassification | null>(
    () => syncEngine.getStatus().lastError || null
  );
  const [processedCount, setProcessedCount] = useState<number>(() => syncEngine.getStatus().processed);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Estatísticas da fila de Outbox
  const [queueStats, setQueueStats] = useState<{
    total: number;
    pending: number;
    failed: number;
    conflict: number;
  }>({ total: 0, pending: 0, failed: 0, conflict: 0 });

  const isMountedRef = useRef<boolean>(true);

  // Função para recarregar estatísticas da Outbox
  const refreshStats = useCallback(async () => {
    try {
      const stats = await syncQueueManager.getQueueStats();
      if (isMountedRef.current) {
        setQueueStats(stats);
      }
    } catch (err) {
      console.warn("[useSyncStatus] Falha ao ler estatísticas da Outbox:", err);
    }
  }, []);

  // Carregar metadados do último sync
  const refreshMetadata = useCallback(async () => {
    try {
      const meta = await getOrCreateSyncMetadata();
      const lastSync = meta.lastActivitiesSync || meta.updatedAt;
      if (isMountedRef.current && lastSync) {
        setLastSyncTime(lastSync);
      }
    } catch {
      // Ignora silenciosamente
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // 1. Carga inicial
    refreshStats();
    refreshMetadata();

    // 2. Escuta eventos de conectividade do navegador
    const handleOnline = () => {
      setIsOnline(true);
      refreshStats();
      refreshMetadata();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshStats();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    // 3. Inscrição nas notificações do Sync Engine
    const unsubscribeEngine = syncEngine.subscribe((event) => {
      if (!isMountedRef.current) return;
      setEngineState(event.state);
      setCurrentMutation(event.currentMutation || null);
      setLastError(event.lastError || null);
      setProcessedCount(event.processed);
      // Sempre que o Engine avança ou conclui, revalida estatísticas
      refreshStats();
      if (event.state === "idle") {
        refreshMetadata();
      }
    });

    // 4. Inscrição nas notificações imediatas de enfileiramento da Outbox
    const unsubscribeOutbox = outboxNotifier.subscribe(() => {
      if (!isMountedRef.current) return;
      refreshStats();
    });

    return () => {
      isMountedRef.current = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
      unsubscribeEngine();
      unsubscribeOutbox();
    };
  }, [refreshStats, refreshMetadata]);

  // Ação de disparo manual da sincronização
  const handleTriggerSync = useCallback(async () => {
    if (!isBrowserOnline()) return;
    await syncEngine.triggerSync();
    await refreshStats();
    await refreshMetadata();
  }, [refreshStats, refreshMetadata]);

  const visualState = deriveNormalizedSyncState({
    isOnline,
    state: engineState,
    pendingCount: queueStats.pending,
    conflictCount: queueStats.conflict,
    failedCount: queueStats.failed,
  });

  return {
    isOnline,
    state: engineState,
    visualState,
    pendingCount: queueStats.pending,
    conflictCount: queueStats.conflict,
    failedCount: queueStats.failed,
    totalCount: queueStats.total,
    processedCount,
    currentMutation,
    lastError,
    lastSyncTime,
    triggerSync: handleTriggerSync,
    refreshStats,
  };
}
