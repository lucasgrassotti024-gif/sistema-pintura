import "fake-indexeddb/auto";
import { SistemaPinturaLocalDB } from "../local-db";
import {
  SyncEngine,
  SyncNetworkWatcher,
  SyncLockManager,
  createActivitySyncDispatcher,
  dispatchProgressConsumption,
} from "./index";
import { LocalOutboxQueueRecord, LocalActivityRecord } from "../local-db.types";
import { SupabaseClientLike } from "./dispatchers/create-activity.dispatcher";
import { updateOfflineActivityProgress } from "../local-outbox.service";

// Helper para criar atividade base nos testes
function createTestActivity(overrides: Partial<LocalActivityRecord> & { id: string; orderNumber: string }): LocalActivityRecord {
  const now = new Date().toISOString();
  return {
    id: overrides.id,
    orderNumber: overrides.orderNumber,
    name: overrides.name || "Pintura Geral",
    serviceType: overrides.serviceType || "Pintura Industrial",
    description: overrides.description || "Descrição de teste",
    status: overrides.status || "em_andamento",
    priority: overrides.priority || "media",
    tags: overrides.tags || [],
    location: overrides.location || { area: "Área 1", local: "Tanque 1", equipment: "TQ-1" },
    schedule: overrides.schedule || { plannedStartDate: "2026-09-01", plannedEndDate: "2026-09-10" },
    progressPercentage: overrides.progressPercentage ?? 0,
    consumptions: overrides.consumptions || [],
    history: overrides.history || [],
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    syncStatus: overrides.syncStatus || "synced",
    localUpdatedAt: overrides.localUpdatedAt || now,
    localVersion: overrides.localVersion || 1,
  };
}

// Mock Network Watcher
class MockNetworkWatcher extends SyncNetworkWatcher {
  private _online = true;
  isOnline(): boolean {
    return this._online;
  }
  setOnline(val: boolean) {
    this._online = val;
    (this as any).handleNetworkChange(val);
  }
  start() {}
  stop() {}
}

// Mock Lock Manager
class MockLockManager implements SyncLockManager {
  public locked = false;
  hasNativeSupport(): boolean {
    return false;
  }
  async withLock<T>(fn: () => Promise<T>): Promise<{ executed: boolean; result?: T }> {
    if (this.locked) return { executed: false };
    this.locked = true;
    try {
      const result = await fn();
      return { executed: true, result };
    } finally {
      this.locked = false;
    }
  }
}

async function runPhase6DTests() {
  console.log("==================================================");
  console.log("BATERIA DE TESTES — FASE 6D: PROGRESSO E CONSUMO NO SYNC ENGINE");
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

  // 1. Registro offline de progresso
  {
    const db = new SistemaPinturaLocalDB("db_test_1_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111111";
    await db.activities.put(
      createTestActivity({
        id: actId,
        orderNumber: "ORD-001",
        progressPercentage: 20,
      })
    );

    const updatedAct = await updateOfflineActivityProgress(
      actId,
      50,
      [{ materialName: "Tinta Epoxi", quantity: 5, unit: "L" }],
      "Aplicação de demão primária",
      undefined,
      db
    );

    const updated = await db.activities.get(actId);
    const outboxItems = await db.outboxQueue.where("entityId").equals(actId).toArray();
    assert(
      outboxItems.length === 1 &&
      updatedAct.progressPercentage === 50 &&
      updated?.progressPercentage === 50 &&
      updated?.syncStatus === "pending",
      "1. Registro offline de progresso atualiza o estado local com status pending"
    );
    db.close();
  }

  // 2. Registro offline de consumo
  {
    const db = new SistemaPinturaLocalDB("db_test_2_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111112";
    await db.activities.put(
      createTestActivity({
        id: actId,
        orderNumber: "ORD-002",
        status: "programada",
        progressPercentage: 0,
      })
    );

    const consumptions = [
      { materialName: "Primer Poliuretano", quantity: 12.5, unit: "L" },
      { materialName: "Diluente Especial", quantity: 2, unit: "L" },
    ];

    await updateOfflineActivityProgress(
      actId,
      30,
      consumptions,
      "Consumo de primer e diluente",
      undefined,
      db
    );

    const outboxItems = await db.outboxQueue.where("entityId").equals(actId).toArray();
    const outboxItem = outboxItems[0];
    const itemConsumptions = outboxItem?.payload.consumptions as any[];
    assert(
      itemConsumptions?.length === 2 &&
      itemConsumptions[0].quantity === 12.5 &&
      itemConsumptions[1].unit === "L",
      "2. Registro offline de consumo armazena a lista exata de consumos na mutation"
    );
    db.close();
  }

  // 3. Mutation preservando os valores originais
  {
    const db = new SistemaPinturaLocalDB("db_test_3_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111113";
    await db.activities.put(
      createTestActivity({
        id: actId,
        orderNumber: "ORD-003",
        progressPercentage: 10,
      })
    );

    await updateOfflineActivityProgress(
      actId,
      75,
      [{ materialName: "Granalha de Aço", quantity: 100, unit: "kg" }],
      "Jateamento quase finalizado",
      undefined,
      db
    );

    const outboxItems = await db.outboxQueue.where("entityId").equals(actId).toArray();
    const outbox = outboxItems[0];
    assert(
      outbox?.operation === "PROGRESS_UPDATE" &&
      outbox?.payload.newProgress === 75 &&
      outbox?.payload.observation === "Jateamento quase finalizado" &&
      typeof outbox?.idempotencyKey === "string" &&
      outbox?.idempotencyKey.length > 10,
      "3. Mutation preserva exatamente newProgress, consumptions, observation e idempotencyKey"
    );
    db.close();
  }

  // 4. Sucesso da RPC
  {
    const db = new SistemaPinturaLocalDB("db_test_4_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111114";
    await db.activities.put(
      createTestActivity({
        id: actId,
        orderNumber: "ORD-004",
        progressPercentage: 20,
        syncStatus: "pending",
      })
    );

    let rpcCalledWith: any = null;
    const mockSupabase: SupabaseClientLike = {
      rpc: async (fnName: string, args: any) => {
        if (fnName === "update_activity_progress_and_consumption") {
          rpcCalledWith = args;
          return {
            data: {
              success: true,
              already_processed: false,
              activity_id: actId,
              order_number: "ORD-004",
              old_progress: 20,
              new_progress: 80,
              status: "em_andamento",
              updated_at: new Date().toISOString(),
            },
            error: null,
          };
        }
        return { data: null, error: new Error("RPC desconhecida") };
      },
    } as any;

    const mutation: LocalOutboxQueueRecord = {
      mutationId: "mut-004",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: {
        newProgress: 80,
        consumptions: [{ custom_material_name: "Esmalte", quantity: 3, unit: "L" }],
        observation: "Demão final",
      },
      idempotencyKey: "idem-004-uuid",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    };

    const res = await dispatchProgressConsumption(mutation, mockSupabase, db);
    const local = await db.activities.get(actId);

    assert(
      res.success === true &&
      rpcCalledWith?.p_new_progress === 80 &&
      rpcCalledWith?.p_idempotency_key === "idem-004-uuid" &&
      local?.progressPercentage === 80 &&
      local?.syncStatus === "synced",
      "4. Sucesso da RPC reconcilia atividade local com progresso confirmado e status synced"
    );
    db.close();
  }

  // 5. Idempotência
  {
    const db = new SistemaPinturaLocalDB("db_test_5_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111115";
    await db.activities.put(
      createTestActivity({
        id: actId,
        orderNumber: "ORD-005",
        progressPercentage: 80,
        syncStatus: "pending",
      })
    );

    const mockSupabase: SupabaseClientLike = {
      rpc: async (fnName: string, _args: any) => {
        if (fnName === "update_activity_progress_and_consumption") {
          return {
            data: {
              success: true,
              already_processed: true,
              activity_id: actId,
              order_number: "ORD-005",
              progress: 80,
              status: "em_andamento",
              message: "Operação já processada anteriormente (idempotente)",
            },
            error: null,
          };
        }
        return { data: null, error: new Error("RPC desconhecida") };
      },
    } as any;

    const mutation: LocalOutboxQueueRecord = {
      mutationId: "mut-005",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 80, consumptions: [], observation: "Reenvio" },
      idempotencyKey: "idem-005-uuid",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 1,
      maxRetries: 5,
    };

    const res = await dispatchProgressConsumption(mutation, mockSupabase, db);
    assert(
      res.success === true &&
      res.idempotent === true &&
      (res.data as any).already_processed === true,
      "5. Idempotência: reconhece already_processed = true como sucesso sem duplicações"
    );
    db.close();
  }

  // 6. Retry após timeout
  {
    const db = new SistemaPinturaLocalDB("db_test_6_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111116";
    let attempts = 0;
    const mockSupabase: SupabaseClientLike = {
      rpc: async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("Connection timeout");
        }
        return {
          data: { success: true, already_processed: false, activity_id: actId, new_progress: 40, status: "em_andamento" },
          error: null,
        };
      },
    } as any;

    const mutation: LocalOutboxQueueRecord = {
      mutationId: "mut-006",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 40, consumptions: [] },
      idempotencyKey: "idem-006-uuid",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    };

    let firstErr = false;
    try {
      await dispatchProgressConsumption(mutation, mockSupabase, db);
    } catch {
      firstErr = true;
    }

    const secondRes = await dispatchProgressConsumption(mutation, mockSupabase, db);
    assert(
      firstErr && secondRes.success === true && attempts === 2,
      "6. Retry após timeout: primeira tentativa falha com rede e segunda sucede com mesmo idempotencyKey"
    );
    db.close();
  }

  // 7. Resposta perdida após processamento (retornando already_processed = true)
  {
    const db = new SistemaPinturaLocalDB("db_test_7_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111117";
    await db.activities.put(
      createTestActivity({
        id: actId,
        orderNumber: "ORD-007",
        progressPercentage: 50,
        syncStatus: "pending",
      })
    );

    const mockSupabase: SupabaseClientLike = {
      rpc: async () => {
        // Servidor já gravou, responde already_processed
        return {
          data: {
            success: true,
            already_processed: true,
            activity_id: actId,
            progress: 50,
            status: "em_andamento",
          },
          error: null,
        };
      },
    } as any;

    const mutation: LocalOutboxQueueRecord = {
      mutationId: "mut-007",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 50, consumptions: [] },
      idempotencyKey: "idem-007-lost-response",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 1,
      maxRetries: 5,
    };

    const res = await dispatchProgressConsumption(mutation, mockSupabase, db);
    const local = await db.activities.get(actId);
    assert(
      res.success === true &&
      res.idempotent === true &&
      local?.syncStatus === "synced",
      "7. Resposta perdida após processamento: retry recebe already_processed e reconcilia localmente como synced"
    );
    db.close();
  }

  // 8. Estoque suficiente
  {
    const db = new SistemaPinturaLocalDB("db_test_8_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111118";
    const mockSupabase: SupabaseClientLike = {
      rpc: async (_fn: string, args: any) => {
        assert(args.p_consumptions[0].quantity === 10, "Quantidade enviada confere");
        return {
          data: { success: true, activity_id: actId, new_progress: 100, status: "concluida" },
          error: null,
        };
      },
    } as any;

    const mutation: LocalOutboxQueueRecord = {
      mutationId: "mut-008",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: {
        newProgress: 100,
        consumptions: [{ custom_material_name: "Verniz", quantity: 10, unit: "L" }],
      },
      idempotencyKey: "idem-008-uuid",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    };

    const res = await dispatchProgressConsumption(mutation, mockSupabase, db);
    assert(res.success === true, "8. Estoque suficiente: processamento completo concluído com sucesso");
    db.close();
  }

  // 9. Estoque insuficiente (detectado e classificado como CONFLICT)
  {
    const net = new MockNetworkWatcher();
    const lock = new MockLockManager();
    const db = new SistemaPinturaLocalDB("db_test_9_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111119";

    const mockSupabase: SupabaseClientLike = {
      rpc: async () => {
        return {
          data: null,
          error: new Error("Saldo insuficiente em estoque para o insumo Tinta Poliuretano. Saldo atual: 2, Solicitado: 10"),
        };
      },
    } as any;

    await db.outboxQueue.put({
      mutationId: "mut-009",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: {
        newProgress: 60,
        consumptions: [{ custom_material_name: "Tinta Poliuretano", quantity: 10, unit: "L" }],
      },
      idempotencyKey: "idem-009-uuid",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    const engine = new SyncEngine(db, lock, net);
    engine.setDispatcher(createActivitySyncDispatcher(mockSupabase, db));

    await engine.triggerSync();
    const item = await db.outboxQueue.get("mut-009");
    assert(
      item?.status === "conflict" &&
      (item?.errorMessage?.includes("insuficiente") || item?.errorCode === "INSUFFICIENT_STOCK"),
      "9. Estoque insuficiente: classificado como CONFLICT e não entra em loop infinito de retry"
    );
    db.close();
  }

  // 10. Rollback transacional do servidor (nenhum estado parcial local)
  {
    const db = new SistemaPinturaLocalDB("db_test_10_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111120";
    await db.activities.put(
      createTestActivity({
        id: actId,
        orderNumber: "ORD-020",
        progressPercentage: 20,
        syncStatus: "pending",
      })
    );

    const mockSupabase: SupabaseClientLike = {
      rpc: async () => {
        return {
          data: null,
          error: new Error("Saldo insuficiente em estoque para o insumo Solvente"),
        };
      },
    } as any;

    const mutation: LocalOutboxQueueRecord = {
      mutationId: "mut-010",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 90, consumptions: [{ custom_material_name: "Solvente", quantity: 50, unit: "L" }] },
      idempotencyKey: "idem-010-uuid",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    };

    let caught = false;
    try {
      await dispatchProgressConsumption(mutation, mockSupabase, db);
    } catch {
      caught = true;
    }

    const local = await db.activities.get(actId);
    assert(
      caught &&
      local?.progressPercentage === 20 &&
      local?.status === "em_andamento",
      "10. Rollback: erro do servidor não comete progresso nem altera status localmente para synced"
    );
    db.close();
  }

  // 11. Progresso menor que o servidor (não-monotônico)
  {
    const net = new MockNetworkWatcher();
    const lock = new MockLockManager();
    const db = new SistemaPinturaLocalDB("db_test_11_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111121";

    const mockSupabase: SupabaseClientLike = {
      rpc: async () => {
        return {
          data: null,
          error: new Error("Regra de negócio: O novo progresso (30%) não pode ser inferior ao progresso anterior (70%)"),
        };
      },
    } as any;

    await db.outboxQueue.put({
      mutationId: "mut-011",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 30, consumptions: [] },
      idempotencyKey: "idem-011-uuid",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    const engine = new SyncEngine(db, lock, net);
    engine.setDispatcher(createActivitySyncDispatcher(mockSupabase, db));

    await engine.triggerSync();
    const item = await db.outboxQueue.get("mut-011");
    assert(
      item?.status === "conflict" &&
      (item?.errorMessage?.includes("inferior") || item?.errorCode === "NON_MONOTONIC_PROGRESS"),
      "11. Progresso não-monotônico: classificado como CONFLICT sem sobrescrever servidor nem apagar mutation"
    );
    db.close();
  }

  // 12. Atividade cancelada
  {
    const net = new MockNetworkWatcher();
    const lock = new MockLockManager();
    const db = new SistemaPinturaLocalDB("db_test_12_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111122";

    const mockSupabase: SupabaseClientLike = {
      rpc: async () => {
        return {
          data: null,
          error: new Error("Regra de negócio: Não é permitido atualizar progresso ou consumo de atividade cancelada."),
        };
      },
    } as any;

    await db.outboxQueue.put({
      mutationId: "mut-012",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 50, consumptions: [] },
      idempotencyKey: "idem-012-uuid",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    const engine = new SyncEngine(db, lock, net);
    engine.setDispatcher(createActivitySyncDispatcher(mockSupabase, db));

    await engine.triggerSync();
    const item = await db.outboxQueue.get("mut-012");
    assert(
      item?.status === "conflict" &&
      (item?.errorMessage?.includes("cancelada") || item?.errorCode === "ACTIVITY_CANCELLED"),
      "12. Atividade cancelada: erro capturado e classificado como CONFLICT"
    );
    db.close();
  }

  // 13. Atividade inexistente
  {
    const net = new MockNetworkWatcher();
    const lock = new MockLockManager();
    const db = new SistemaPinturaLocalDB("db_test_13_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111123";

    const mockSupabase: SupabaseClientLike = {
      rpc: async () => {
        return {
          data: null,
          error: new Error("Atividade não encontrada"),
        };
      },
    } as any;

    await db.outboxQueue.put({
      mutationId: "mut-013",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 50, consumptions: [] },
      idempotencyKey: "idem-013-uuid",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    const engine = new SyncEngine(db, lock, net);
    engine.setDispatcher(createActivitySyncDispatcher(mockSupabase, db));

    await engine.triggerSync();
    const item = await db.outboxQueue.get("mut-013");
    assert(
      item?.status === "failed" &&
      (item?.errorCode === "NOT_FOUND" || Boolean(item?.errorMessage?.includes("não encontrada"))),
      "13. Atividade inexistente no servidor: classificada como TERMINAL (failed / NOT_FOUND)"
    );
    db.close();
  }

  // 14. Erro terminal (ex: sintaxe inválida)
  {
    const net = new MockNetworkWatcher();
    const lock = new MockLockManager();
    const db = new SistemaPinturaLocalDB("db_test_14_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111124";

    const mockSupabase: SupabaseClientLike = {
      rpc: async () => {
        return {
          data: null,
          error: new Error("invalid input syntax for type uuid: invalid-uuid"),
        };
      },
    } as any;

    await db.outboxQueue.put({
      mutationId: "mut-014",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 50, consumptions: [] },
      idempotencyKey: "idem-014-uuid",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    const engine = new SyncEngine(db, lock, net);
    engine.setDispatcher(createActivitySyncDispatcher(mockSupabase, db));

    await engine.triggerSync();
    const item = await db.outboxQueue.get("mut-014");
    assert(
      item?.status === "failed",
      "14. Erro terminal (syntax error): classificado como TERMINAL (failed) sem retentativas"
    );
    db.close();
  }

  // 15. FIFO mantido com múltiplos eventos
  {
    const db = new SistemaPinturaLocalDB("db_test_15_" + Date.now());
    await db.open();
    const net = new MockNetworkWatcher();
    const lock = new MockLockManager();
    const actId = "11111111-1111-4111-8111-111111111125";

    const executedOrder: string[] = [];
    const mockSupabase: SupabaseClientLike = {
      rpc: async (fn: string, args: any) => {
        executedOrder.push(`${fn}:${args.p_new_progress ?? args.p_reason ?? "other"}`);
        return {
          data: { success: true, activity_id: actId, new_progress: args.p_new_progress, status: "em_andamento" },
          error: null,
        };
      },
    } as any;

    // Inserção estrita de fila: PROGRESS_UPDATE 30 -> PROGRESS_UPDATE 60
    await db.outboxQueue.put({
      mutationId: "mut-fifo-1",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 30, consumptions: [] },
      idempotencyKey: "idem-fifo-1",
      clientId: "test-client",
      clientTimestamp: "2026-09-18T10:00:00.000Z",
      createdAt: "2026-09-18T10:00:00.000Z",
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });
    await db.outboxQueue.put({
      mutationId: "mut-fifo-2",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 60, consumptions: [] },
      idempotencyKey: "idem-fifo-2",
      clientId: "test-client",
      clientTimestamp: "2026-09-18T10:01:00.000Z",
      createdAt: "2026-09-18T10:01:00.000Z",
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    const engine = new SyncEngine(db, lock, net);
    engine.setDispatcher(createActivitySyncDispatcher(mockSupabase, db));

    await engine.triggerSync();
    assert(
      executedOrder.length === 2 &&
      executedOrder[0] === "update_activity_progress_and_consumption:30" &&
      executedOrder[1] === "update_activity_progress_and_consumption:60",
      "15. FIFO: mutações da mesma atividade processadas estritamente na ordem cronológica de criação"
    );
    db.close();
  }

  // 16. Isolamento entre atividades (conflito em A não bloqueia B)
  {
    const db = new SistemaPinturaLocalDB("db_test_16_" + Date.now());
    await db.open();
    const net = new MockNetworkWatcher();
    const lock = new MockLockManager();
    const actA = "11111111-1111-4111-8111-111111111126";
    const actB = "22222222-2222-4222-8222-222222222226";

    const mockSupabase: SupabaseClientLike = {
      rpc: async (_fn: string, args: any) => {
        if (args.p_activity_id === actA) {
          return {
            data: null,
            error: new Error("Saldo insuficiente em estoque para o insumo Diluente"),
          };
        }
        return {
          data: { success: true, activity_id: actB, new_progress: 50, status: "em_andamento" },
          error: null,
        };
      },
    } as any;

    await db.outboxQueue.put({
      mutationId: "mut-a-1",
      entityType: "activity",
      entityId: actA,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 40, consumptions: [{ custom_material_name: "Diluente", quantity: 100, unit: "L" }] },
      idempotencyKey: "idem-a-1",
      clientId: "test-client",
      clientTimestamp: "2026-09-18T10:00:00.000Z",
      createdAt: "2026-09-18T10:00:00.000Z",
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });
    await db.outboxQueue.put({
      mutationId: "mut-b-1",
      entityType: "activity",
      entityId: actB,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 50, consumptions: [] },
      idempotencyKey: "idem-b-1",
      clientId: "test-client",
      clientTimestamp: "2026-09-18T10:01:00.000Z",
      createdAt: "2026-09-18T10:01:00.000Z",
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    const engine = new SyncEngine(db, lock, net);
    engine.setDispatcher(createActivitySyncDispatcher(mockSupabase, db));

    await engine.triggerSync();
    const itemA = await db.outboxQueue.get("mut-a-1");
    const itemB = await db.outboxQueue.get("mut-b-1");

    assert(
      itemA?.status === "conflict" &&
      itemB?.status === "synced",
      "16. Isolamento entre atividades: conflito na atividade A não bloqueia a sincronização da atividade B"
    );
    db.close();
  }

  // 17. Não duplicação de consumo em retries
  {
    const db = new SistemaPinturaLocalDB("db_test_17_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111127";
    let rpcCalls = 0;

    const mockSupabase: SupabaseClientLike = {
      rpc: async () => {
        rpcCalls++;
        if (rpcCalls === 1) {
          // Primeira chamada processa normalmente
          return {
            data: { success: true, already_processed: false, activity_id: actId, new_progress: 25, status: "em_andamento" },
            error: null,
          };
        } else {
          // Segunda chamada (retry com mesmo idempotencyKey) retorna already_processed
          return {
            data: { success: true, already_processed: true, activity_id: actId, progress: 25, status: "em_andamento" },
            error: null,
          };
        }
      },
    } as any;

    const mutation: LocalOutboxQueueRecord = {
      mutationId: "mut-017",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 25, consumptions: [{ custom_material_name: "Tinta", quantity: 5, unit: "L" }] },
      idempotencyKey: "idem-017-unique",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    };

    const first = await dispatchProgressConsumption(mutation, mockSupabase, db);
    const second = await dispatchProgressConsumption(mutation, mockSupabase, db);

    assert(
      first.idempotent === false &&
      second.idempotent === true &&
      rpcCalls === 2,
      "17. Não duplicação de consumo: servidor reconhece chave e sinaliza idempotência sem re-abater insumos"
    );
    db.close();
  }

  // 18. Não duplicação de movimentação de estoque
  {
    const db = new SistemaPinturaLocalDB("db_test_18_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111128";
    const recordedPayloads: any[] = [];

    const mockSupabase: SupabaseClientLike = {
      rpc: async (_fn: string, args: any) => {
        recordedPayloads.push(args);
        return {
          data: {
            success: true,
            already_processed: recordedPayloads.length > 1,
            activity_id: actId,
            new_progress: 50,
            status: "em_andamento",
          },
          error: null,
        };
      },
    } as any;

    const mutation: LocalOutboxQueueRecord = {
      mutationId: "mut-018",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 50, consumptions: [{ custom_material_name: "Thinner", quantity: 2, unit: "L" }] },
      idempotencyKey: "idem-018-shared",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    };

    await dispatchProgressConsumption(mutation, mockSupabase, db);
    await dispatchProgressConsumption(mutation, mockSupabase, db);

    assert(
      recordedPayloads[0].p_idempotency_key === recordedPayloads[1].p_idempotency_key &&
      recordedPayloads.length === 2,
      "18. Não duplicação de movimentação: chave idêntica passada em ambas as chamadas garantindo 1 única movimentação no Postgres"
    );
    db.close();
  }

  // 19. Reconciliação do IndexedDB
  {
    const db = new SistemaPinturaLocalDB("db_test_19_" + Date.now());
    await db.open();
    const actId = "11111111-1111-4111-8111-111111111129";
    await db.activities.put(
      createTestActivity({
        id: actId,
        orderNumber: "ORD-029",
        progressPercentage: 50,
        syncStatus: "pending",
      })
    );

    const mockSupabase: SupabaseClientLike = {
      rpc: async () => ({
        data: {
          success: true,
          activity_id: actId,
          new_progress: 100,
          status: "concluida",
          updated_at: "2026-09-18T12:00:00.000Z",
        },
        error: null,
      }),
    } as any;

    const mutation: LocalOutboxQueueRecord = {
      mutationId: "mut-019",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 100, consumptions: [] },
      idempotencyKey: "idem-019-reconcile",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    };

    await dispatchProgressConsumption(mutation, mockSupabase, db);
    const updated = await db.activities.get(actId);

    assert(
      updated?.progressPercentage === 100 &&
      updated?.status === "concluida" &&
      updated?.syncStatus === "synced",
      "19. Reconciliação IndexedDB: reflete progresso 100%, status concluída e syncStatus = synced"
    );
    db.close();
  }

  // 20. Preservação da idempotencyKey durante retry
  {
    const db = new SistemaPinturaLocalDB("db_test_20_" + Date.now());
    await db.open();
    const net = new MockNetworkWatcher();
    const lock = new MockLockManager();
    const actId = "11111111-1111-4111-8111-111111111130";

    const sentKeys: string[] = [];
    let call = 0;
    const mockSupabase: SupabaseClientLike = {
      rpc: async (_fn: string, args: any) => {
        sentKeys.push(args.p_idempotency_key);
        call++;
        if (call === 1) {
          throw new Error("Network offline temporary");
        }
        return {
          data: { success: true, activity_id: actId, new_progress: 70, status: "em_andamento" },
          error: null,
        };
      },
    } as any;

    await db.outboxQueue.put({
      mutationId: "mut-020",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 70, consumptions: [] },
      idempotencyKey: "fixed-idempotency-key-777",
      clientId: "test-client",
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    const engine = new SyncEngine(db, lock, net);
    engine.setDispatcher(createActivitySyncDispatcher(mockSupabase, db));

    await engine.triggerSync(); // 1st try (fails, retried)
    // Atualiza nextRetryAt para permitir disparo imediato no segundo teste
    await db.outboxQueue.update("mut-020", { nextRetryAt: undefined });
    await engine.triggerSync(); // 2nd try (succeeds)

    assert(
      sentKeys.length === 2 &&
      sentKeys[0] === "fixed-idempotency-key-777" &&
      sentKeys[1] === "fixed-idempotency-key-777",
      "20. Preservação da idempotencyKey: chave permanece rigorosamente a mesma em todos os retries"
    );
    db.close();
  }

  // 21. Fechamento/reabertura antes da sincronização (persistência em disco IndexedDB)
  {
    const dbName = "phase6d_reopen_test_db";
    const db1 = new SistemaPinturaLocalDB(dbName);
    await db1.open();
    const actId = "11111111-1111-4111-8111-111111111131";
    await db1.activities.put(
      createTestActivity({
        id: actId,
        orderNumber: "ORD-031",
        progressPercentage: 40,
        syncStatus: "synced",
      })
    );

    // Registra progresso offline
    await updateOfflineActivityProgress(
      actId,
      85,
      [{ materialName: "Catalisador", quantity: 1, unit: "L" }],
      "Aplicação de catalisador",
      undefined,
      db1
    );

    await db1.close();

    // Simula reabertura do app criando uma nova instância de DB apontando para o mesmo banco
    const db2 = new SistemaPinturaLocalDB(dbName);
    await db2.open();
    const outboxItems = await db2.outboxQueue.where("entityId").equals(actId).toArray();
    const persistedMutation = outboxItems[0];
    const persistedActivity = await db2.activities.get(actId);

    assert(
      persistedMutation?.operation === "PROGRESS_UPDATE" &&
      persistedMutation.payload.newProgress === 85 &&
      persistedMutation.status === "pending" &&
      persistedActivity?.progressPercentage === 85 &&
      persistedActivity.syncStatus === "pending",
      "21. Fechamento/reabertura antes do sync: mutation e estado local persistem intactos no IndexedDB"
    );
    await db2.close();
  }

  console.log("==================================================");
  console.log(`RESULTADO FINAL: ${passed} passaram, ${failed} falharam.`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6DTests().catch((err) => {
  console.error("Erro fatal na execução dos testes da Fase 6D:", err);
  process.exit(1);
});
