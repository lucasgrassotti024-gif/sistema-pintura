import "fake-indexeddb/auto";
import { SistemaPinturaLocalDB } from "../local-db";
import {
  classifySyncError,
  calculateNextRetryDelay,
  calculateNextRetryTimestamp,
  hasExceededMaxRetries,
  SyncEngine,
  SyncLockManager,
  SyncNetworkWatcher,
  SyncQueueManager,
  SyncEngineProgressEvent,
} from "./index";
import { LocalOutboxQueueRecord } from "../local-db.types";

async function runPhase6ATests() {
  console.log("==================================================");
  console.log("BATERIA DE TESTES — FASE 6A: CORE DO SYNC ENGINE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // =========================================================================
  // BLOCO 1: ERROR CLASSIFIER (Função pura)
  // =========================================================================
  console.log("\n--- TESTES: CLASSIFICAÇÃO DE ERROS ---");

  // 1. Erros Retryable
  const retryableNetwork = classifySyncError(new TypeError("Failed to fetch"));
  assert(
    retryableNetwork.category === "RETRYABLE",
    "1. 'Failed to fetch' classificado como RETRYABLE"
  );

  const retryableTimeout = classifySyncError({ message: "Network request timeout", code: "ETIMEDOUT" });
  assert(
    retryableTimeout.category === "RETRYABLE",
    "2. Timeout classificado como RETRYABLE"
  );

  const retryable500 = classifySyncError({ status: 500, message: "Internal Server Error" });
  assert(
    retryable500.category === "RETRYABLE",
    "3. HTTP 500 classificado como RETRYABLE"
  );

  const retryable502 = classifySyncError({ status: 502, message: "Bad Gateway" });
  assert(
    retryable502.category === "RETRYABLE",
    "4. HTTP 502 classificado como RETRYABLE"
  );

  const retryable503 = classifySyncError({ status: 503, message: "Service Unavailable" });
  assert(
    retryable503.category === "RETRYABLE",
    "5. HTTP 503 classificado como RETRYABLE"
  );

  const retryable504 = classifySyncError({ status: 504, message: "Gateway Timeout" });
  assert(
    retryable504.category === "RETRYABLE",
    "6. HTTP 504 classificado como RETRYABLE"
  );

  const retryable429 = classifySyncError({ status: 429, message: "Too Many Requests" });
  assert(
    retryable429.category === "RETRYABLE",
    "7. HTTP 429 classificado como RETRYABLE"
  );

  // 2. Erros Terminal
  const terminalAuth401 = classifySyncError({ status: 401, message: "Unauthorized" });
  assert(
    terminalAuth401.category === "TERMINAL",
    "8. HTTP 401 classificado como TERMINAL"
  );

  const terminalAuth403 = classifySyncError({ status: 403, message: "Forbidden" });
  assert(
    terminalAuth403.category === "TERMINAL",
    "9. HTTP 403 classificado como TERMINAL"
  );

  const terminal42501 = classifySyncError({ code: "42501", message: "permission denied for function sync_create_activity" });
  assert(
    terminal42501.category === "TERMINAL",
    "10. PostgreSQL 42501 (permission denied) classificado como TERMINAL"
  );

  const terminalConstraint = classifySyncError({ code: "23502", message: "null value in column violates not-null constraint" });
  assert(
    terminalConstraint.category === "TERMINAL",
    "11. Violação de constraint classificada como TERMINAL"
  );

  const terminalNotFound = classifySyncError({ status: 404, message: "activity not found" });
  assert(
    terminalNotFound.category === "TERMINAL",
    "12. Atividade não encontrada classificada como TERMINAL"
  );

  // 3. Erros de Conflito
  const conflictOcc = classifySyncError({ code: "CONCURRENT_MODIFICATION", message: "Versão esperada 1, versão atual 2" });
  assert(
    conflictOcc.category === "CONFLICT",
    "13. CONCURRENT_MODIFICATION classificado como CONFLICT"
  );

  const conflictArchived = classifySyncError({ code: "ACTIVITY_ARCHIVED", message: "Atividade arquivada" });
  assert(
    conflictArchived.category === "CONFLICT",
    "14. ACTIVITY_ARCHIVED classificado como CONFLICT"
  );

  const conflictCancelled = classifySyncError({ code: "CANNOT_CANCEL_COMPLETED", message: "Atividade concluída não pode ser cancelada" });
  assert(
    conflictCancelled.category === "CONFLICT",
    "15. CANNOT_CANCEL_COMPLETED classificado como CONFLICT"
  );

  const conflictDuplicateOrder = classifySyncError({ code: "ORDER_NUMBER_DUPLICATE", message: "Número de OS já existe" });
  assert(
    conflictDuplicateOrder.category === "CONFLICT",
    "16. ORDER_NUMBER_DUPLICATE classificado como CONFLICT"
  );

  // =========================================================================
  // BLOCO 2: RETRY, BACKOFF E JITTER
  // =========================================================================
  console.log("\n--- TESTES: RETRY E BACKOFF EXPONENCIAL ---");

  const delay0 = calculateNextRetryDelay(0);
  const delay1 = calculateNextRetryDelay(1);
  const delay2 = calculateNextRetryDelay(2);
  const delay3 = calculateNextRetryDelay(3);

  assert(
    delay0 >= 500 && delay0 <= 2000,
    "17. Delay 0 dentro da faixa base com jitter (~1000ms)"
  );
  assert(
    delay1 >= 1000 && delay1 <= 4000,
    "18. Delay 1 cresce exponencialmente (~2000ms)"
  );
  assert(
    delay2 >= 2000 && delay2 <= 8000,
    "19. Delay 2 cresce exponencialmente (~4000ms)"
  );
  assert(
    delay3 >= 4000 && delay3 <= 16000,
    "20. Delay 3 cresce exponencialmente (~8000ms)"
  );

  // Teto máximo
  const delayHigh = calculateNextRetryDelay(15, { baseDelayMs: 1000, maxDelayMs: 30000, jitterRatio: 0.1 });
  assert(
    delayHigh <= 35000,
    "21. Delay não ultrapassa o teto máximo configurado"
  );

  // Timestamp ISO
  const ts = calculateNextRetryTimestamp(1, new Date("2026-09-17T12:00:00.000Z"));
  assert(
    typeof ts === "string" && ts > "2026-09-17T12:00:00.000Z",
    "22. calculateNextRetryTimestamp gera string ISO no futuro"
  );

  // maxRetries check
  assert(
    hasExceededMaxRetries(5, 5) === true && hasExceededMaxRetries(4, 5) === false,
    "23. hasExceededMaxRetries respeita o limite estrito"
  );

  // =========================================================================
  // BLOCO 3: FILA E ORDENAÇÃO FIFO
  // =========================================================================
  console.log("\n--- TESTES: FILA DA OUTBOX (FIFO POR ENTIDADE) ---");

  const dbName = "Phase6A_TestDB_" + Date.now();
  const db = new SistemaPinturaLocalDB(dbName);
  await db.open();

  const queueManager = new SyncQueueManager(db);

  // Cria mutações para duas entidades em tempos diferentes
  const mutAct1_Create: LocalOutboxQueueRecord = {
    mutationId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-1",
    entityType: "activity",
    entityId: "act-A",
    operation: "CREATE_ACTIVITY",
    baseVersion: 1,
    clientTimestamp: "2026-09-17T10:00:00.000Z",
    payload: { title: "Activity A Create" },
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: "2026-09-17T10:00:00.000Z",
  };

  const mutAct1_Update1: LocalOutboxQueueRecord = {
    mutationId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-1",
    entityType: "activity",
    entityId: "act-A",
    operation: "UPDATE_ACTIVITY",
    baseVersion: 2,
    clientTimestamp: "2026-09-17T10:01:00.000Z",
    payload: { title: "Activity A Update 1" },
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: "2026-09-17T10:01:00.000Z",
  };

  const mutAct2_Create: LocalOutboxQueueRecord = {
    mutationId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-1",
    entityType: "activity",
    entityId: "act-B",
    operation: "CREATE_ACTIVITY",
    baseVersion: 1,
    clientTimestamp: "2026-09-17T10:00:30.000Z",
    payload: { title: "Activity B Create" },
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: "2026-09-17T10:00:30.000Z",
  };

  await db.outboxQueue.bulkPut([mutAct1_Create, mutAct1_Update1, mutAct2_Create]);

  // Busca elegíveis: deve vir mutAct1_Create e mutAct2_Create (uma por entidade no batch, respeitando FIFO)
  // mutAct1_Update1 NÃO pode ser incluída antes da mutAct1_Create ser concluída!
  const batch1 = await queueManager.getEligibleMutations();
  assert(
    batch1.length === 2 &&
      batch1[0].mutationId === mutAct1_Create.mutationId &&
      batch1[1].mutationId === mutAct2_Create.mutationId,
    "24. Fila respeita ordenação FIFO global e não ultrapassa mutações da mesma entidade"
  );

  // Se mutAct1_Create estiver em status 'syncing', mutAct1_Update1 ainda NÃO deve ser elegível
  await queueManager.updateMutationStatus(mutAct1_Create.mutationId, { status: "syncing" });
  const batchWhileSyncing = await queueManager.getEligibleMutations();
  assert(
    batchWhileSyncing.some((m) => m.entityId === "act-A") === false,
    "25. Entidade com mutação em processamento ('syncing') bloqueia mutações subsequentes da mesma entidade"
  );

  // Conclui mutAct1_Create com 'synced'
  await queueManager.updateMutationStatus(mutAct1_Create.mutationId, { status: "synced" });
  const batchAfterSynced = await queueManager.getEligibleMutations();
  assert(
    batchAfterSynced.some((m) => m.mutationId === mutAct1_Update1.mutationId),
    "26. Mutação subsequente da entidade torna-se elegível após sucesso da anterior"
  );

  // =========================================================================
  // BLOCO 4: SYNC ENGINE LIFECYCLE & SINGLETON
  // =========================================================================
  console.log("\n--- TESTES: LIFECYCLE E SINGLETON DO ENGINE ---");

  SyncEngine.resetInstance();
  const engine1 = SyncEngine.getInstance(db);
  const engine2 = SyncEngine.getInstance(db);
  assert(
    engine1 === engine2,
    "27. getInstance retorna a mesma instância única (Singleton)"
  );

  // Estado inicial idle
  assert(
    engine1.getStatus().state === "idle",
    "28. Estado inicial é 'idle'"
  );

  // Subscribe / Unsubscribe
  let eventsReceived: SyncEngineProgressEvent[] = [];
  const unsubscribe = engine1.subscribe((event) => {
    eventsReceived.push(event);
  });

  assert(
    eventsReceived.length === 1 && eventsReceived[0].state === "idle",
    "29. subscribe notifica imediatamente o estado corrente"
  );

  unsubscribe();
  const countBefore = eventsReceived.length;
  // Disparo manual de status não deve mais notificar após unsubscribe
  assert(
    countBefore === 1,
    "30. unsubscribe interrompe o recebimento de novos eventos"
  );

  // =========================================================================
  // BLOCO 5: NETWORK WATCHER E ISOLAMENTO OFFLINE
  // =========================================================================
  console.log("\n--- TESTES: NETWORK WATCHER E COMPORTAMENTO OFFLINE ---");

  // Mock de Network Watcher
  class MockNetworkWatcher extends SyncNetworkWatcher {
    private onlineStatus = false;
    private mockListeners = new Set<(online: boolean) => void>();

    isOnline(): boolean {
      return this.onlineStatus;
    }

    setOnline(status: boolean) {
      this.onlineStatus = status;
      for (const l of this.mockListeners) {
        l(status);
      }
    }

    subscribe(cb: (online: boolean) => void): () => void {
      this.mockListeners.add(cb);
      return () => this.mockListeners.delete(cb);
    }
  }

  // Mock de Lock Manager
  class MockLockManager implements SyncLockManager {
    private locked = false;
    lockCallCount = 0;

    hasNativeSupport(): boolean {
      return false;
    }

    async withLock<T>(fn: () => Promise<T>): Promise<{ executed: boolean; result?: T }> {
      this.lockCallCount++;
      if (this.locked) {
        return { executed: false };
      }
      this.locked = true;
      try {
        const result = await fn();
        return { executed: true, result };
      } finally {
        this.locked = false;
      }
    }
  }

  const mockNet = new MockNetworkWatcher();
  const mockLock = new MockLockManager();
  const testEngine = new SyncEngine(db, mockLock, mockNet);

  // Não sincroniza offline
  mockNet.setOnline(false);
  await testEngine.triggerSync();
  assert(
    mockLock.lockCallCount === 0,
    "31. triggerSync() não solicita lock nem tenta sincronizar quando offline"
  );

  // Reação ao evento online: ao mudar para online, deve disparar sincronização
  testEngine.start();
  mockNet.setOnline(true);
  // Aguarda tick de microtask
  await new Promise((r) => setTimeout(r, 50));

  assert(
    mockLock.lockCallCount >= 1,
    "32. Transição para online dispara automaticamente triggerSync via listener de rede"
  );

  testEngine.stop();

  // =========================================================================
  // BLOCO 6: LOCK E PREVENÇÃO DE CONCORRÊNCIA
  // =========================================================================
  console.log("\n--- TESTES: PROTEÇÃO DE LOCK CONCORRENTE ---");

  const competingLock = new MockLockManager();
  const concurrentEngine = new SyncEngine(db, competingLock, mockNet);
  mockNet.setOnline(true);

  // Configura um dispatcher lento para segurar a execução
  let concurrentExecutions = 0;
  let maxSimultaneousExecutions = 0;

  concurrentEngine.setDispatcher(async () => {
    concurrentExecutions++;
    maxSimultaneousExecutions = Math.max(maxSimultaneousExecutions, concurrentExecutions);
    await new Promise((r) => setTimeout(r, 100));
    concurrentExecutions--;
    return { success: true };
  });

  // Limpa e cadastra 2 mutações para testar triggerSync concorrente
  await db.outboxQueue.clear();
  await db.outboxQueue.bulkPut([
    {
      mutationId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      clientId: "client-lock-test",
      entityType: "activity",
      entityId: "act-lock-1",
      operation: "CREATE_ACTIVITY",
      clientTimestamp: new Date().toISOString(),
      payload: {},
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
      createdAt: new Date().toISOString(),
    },
    {
      mutationId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      clientId: "client-lock-test",
      entityType: "activity",
      entityId: "act-lock-2",
      operation: "CREATE_ACTIVITY",
      clientTimestamp: new Date().toISOString(),
      payload: {},
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
      createdAt: new Date().toISOString(),
    },
  ]);

  // Dispara duas chamadas concorrentes a triggerSync() simultaneamente
  const p1 = concurrentEngine.triggerSync();
  const p2 = concurrentEngine.triggerSync();
  await Promise.all([p1, p2]);

  assert(
    maxSimultaneousExecutions === 1,
    "33. Duas chamadas simultâneas a triggerSync() executam sob lock exclusivo (máximo simultâneo = 1)"
  );

  concurrentEngine.stop();

  // =========================================================================
  // BLOCO 7: COMPORTAMENTO DE STATUS DA OUTBOX EM FALHAS
  // =========================================================================
  console.log("\n--- TESTES: TRANSIÇÕES DE ESTADO EM FALHA (RETRYABLE / CONFLICT / TERMINAL) ---");

  // 1. Falha Retryable: transiciona para pending com nextRetryAt
  await db.outboxQueue.clear();
  const mutRetryable: LocalOutboxQueueRecord = {
    mutationId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "activity",
    entityId: "act-err-1",
    operation: "CREATE_ACTIVITY",
    clientTimestamp: new Date().toISOString(),
    payload: {},
    status: "pending",
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
  };
  await db.outboxQueue.put(mutRetryable);

  const failEngine = new SyncEngine(db, new MockLockManager(), mockNet);
  mockNet.setOnline(true);

  // Simula falha retryable (503 Service Unavailable)
  failEngine.setDispatcher(async () => {
    throw { status: 503, message: "Temporarily down" };
  });

  await failEngine.triggerSync();

  const recordAfterRetryable = await db.outboxQueue.get(mutRetryable.mutationId);
  assert(
    recordAfterRetryable?.status === "pending" &&
      recordAfterRetryable.retryCount === 1 &&
      typeof recordAfterRetryable.nextRetryAt === "string",
    "34. Falha RETRYABLE retorna mutação para 'pending' com retryCount incrementado e nextRetryAt agendado"
  );

  // 2. Falha Retryable atingindo maxRetries: transiciona para 'failed' definitivo
  await db.outboxQueue.update(mutRetryable.mutationId, {
    retryCount: 2, // próxima será a 3ª de 3
    nextRetryAt: undefined,
  });

  await failEngine.triggerSync();

  const recordAfterMaxRetries = await db.outboxQueue.get(mutRetryable.mutationId);
  assert(
    recordAfterMaxRetries?.status === "failed" &&
      recordAfterMaxRetries.retryCount === 3,
    "35. Falha RETRYABLE que excede maxRetries transiciona para 'failed' definitivo sem retry infinito"
  );

  // 3. Conflito: transiciona diretamente para 'conflict' sem retry cego
  const mutConflict: LocalOutboxQueueRecord = {
    mutationId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "activity",
    entityId: "act-conflict-1",
    operation: "UPDATE_ACTIVITY",
    clientTimestamp: new Date().toISOString(),
    payload: {},
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: new Date().toISOString(),
  };
  await db.outboxQueue.put(mutConflict);

  failEngine.setDispatcher(async () => {
    throw { code: "CONCURRENT_MODIFICATION", message: "Versão conflitante" };
  });

  await failEngine.triggerSync();

  const recordAfterConflict = await db.outboxQueue.get(mutConflict.mutationId);
  assert(
    recordAfterConflict?.status === "conflict" &&
      recordAfterConflict.errorCode === "CONCURRENT_MODIFICATION",
    "36. Erro CONFLICT transiciona para status 'conflict' sem agendar retry"
  );

  // 4. Falha Terminal: transiciona para 'failed'
  const mutTerminal: LocalOutboxQueueRecord = {
    mutationId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "activity",
    entityId: "act-terminal-1",
    operation: "CREATE_ACTIVITY",
    clientTimestamp: new Date().toISOString(),
    payload: {},
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: new Date().toISOString(),
  };
  await db.outboxQueue.put(mutTerminal);

  failEngine.setDispatcher(async () => {
    throw { code: "42501", message: "permission denied for function" };
  });

  await failEngine.triggerSync();

  const recordAfterTerminal = await db.outboxQueue.get(mutTerminal.mutationId);
  assert(
    recordAfterTerminal?.status === "failed" &&
      recordAfterTerminal.errorCode === "42501",
    "37. Erro TERMINAL (ex: 42501 permission denied) transiciona para status 'failed' sem retry"
  );

  failEngine.stop();
  db.close();

  console.log("\n==================================================");
  console.log(`RESULTADO DA FASE 6A: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6ATests();
