import "fake-indexeddb/auto";
import { SistemaPinturaLocalDB } from "../local-db";
import {
  SyncEngine,
  SyncNetworkWatcher,
  SyncLockManager,
  createActivitySyncDispatcher,
  dispatchCreateActivity,
  dispatchUpdateActivity,
  dispatchCancelActivity,
} from "./index";
import { LocalOutboxQueueRecord, LocalActivityRecord } from "../local-db.types";
import { SupabaseClientLike } from "./dispatchers/create-activity.dispatcher";

// Mock Network Watcher para controle fino nos testes
class MockNetworkWatcher extends SyncNetworkWatcher {
  private _online = true;
  constructor() {
    super();
  }
  isOnline(): boolean {
    return this._online;
  }
  setOnline(val: boolean) {
    this._online = val;
    // Dispara subscribers do SyncNetworkWatcher
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

async function runPhase6BTests() {
  console.log("==================================================");
  console.log("BATERIA DE TESTES — FASE 6B: DISPATCHERS DE ATIVIDADES");
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

  const db = new SistemaPinturaLocalDB("phase6b_test_db_" + Date.now());
  await db.open();

  // =========================================================================
  // BLOCO 1: DISPATCHER CREATE_ACTIVITY
  // =========================================================================
  console.log("\n--- TESTES: DISPATCHER CREATE_ACTIVITY ---");

  const actId1 = crypto.randomUUID();
  const idempotencyKey1 = crypto.randomUUID();

  // 1. Criação de atividade local
  const localAct1: LocalActivityRecord = {
    id: actId1,
    orderNumber: "OS-6B-001",
    name: "Pintura Tanque 1",
    serviceType: "Pintura Industrial",
    description: "Pintura epóxi bicomponente",
    status: "programada",
    priority: "alta",
    progressPercentage: 0,
    tags: [{ id: "tag-1", code: "TAG-TQ-01" }],
    location: { area: "Área de Tancagem", local: "Tanque 01", equipment: "TQ-01" },
    schedule: { plannedStartDate: "2026-10-01", plannedEndDate: "2026-10-05" },
    plannedMaterials: [
      { id: "pm-1", materialName: "Tinta Epóxi", quantity: 50, unit: "L" }
    ],
    consumptions: [],
    history: [],
    syncStatus: "pending",
    localUpdatedAt: new Date().toISOString(),
    localVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.activities.put(localAct1);

  const createMutation1: LocalOutboxQueueRecord = {
    mutationId: crypto.randomUUID(),
    idempotencyKey: idempotencyKey1,
    clientId: "client-6b-test",
    entityType: "activity",
    entityId: actId1,
    operation: "CREATE_ACTIVITY",
    baseVersion: 1,
    clientTimestamp: new Date().toISOString(),
    payload: {
      activityId: actId1,
      orderNumber: localAct1.orderNumber,
      name: localAct1.name,
      serviceType: localAct1.serviceType,
      tags: localAct1.tags,
      location: localAct1.location,
      description: localAct1.description,
      status: localAct1.status,
      priority: localAct1.priority,
      plannedMaterials: localAct1.plannedMaterials,
      schedule: localAct1.schedule,
    },
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: new Date().toISOString(),
  };

  // Mock Supabase para CREATE com sucesso
  let rpcCreateCalls: Array<Record<string, unknown>> = [];
  const createMockQueryBuilder = () => {
    const builder: any = {
      eq: () => builder,
      select: () => builder,
      insert: () => builder,
      single: async () => ({ data: { id: "resolved-uuid-1" }, error: null }),
      maybeSingle: async () => ({ data: { id: "resolved-uuid-1" }, error: null }),
    };
    return builder;
  };

  const mockSupabaseCreateSuccess: SupabaseClientLike = {
    from: () => createMockQueryBuilder(),
    rpc: async (fnName: string, params: any) => {
      if (fnName === "sync_create_activity") {
        rpcCreateCalls.push(params);
        return {
          data: {
            success: true,
            idempotent: false,
            activity_id: params.p_activity_id,
            order_number: params.p_order_number,
            server_version: 1,
            created_at: new Date().toISOString(),
          },
          error: null,
        };
      }
      return { data: null, error: new Error("RPC não encontrada") };
    },
  };

  // 1. Sucesso no CREATE_ACTIVITY
  const resCreate = await dispatchCreateActivity(createMutation1, mockSupabaseCreateSuccess, db);
  assert(resCreate.success === true, "1. dispatchCreateActivity executa com sucesso");
  assert(
    rpcCreateCalls.length === 1 && rpcCreateCalls[0].p_activity_id === actId1,
    "2. Envia exatamente o UUID local da atividade para a RPC sync_create_activity"
  );
  assert(
    rpcCreateCalls[0].p_idempotency_key === idempotencyKey1,
    "3. Envia idempotency_key estável anti-duplicação"
  );

  const actAfterCreate = await db.activities.get(actId1);
  assert(
    actAfterCreate?.syncStatus === "synced" && actAfterCreate?.localVersion === 1,
    "4. Reconciliação local no IndexedDB atualiza syncStatus para 'synced' e localVersion=1"
  );

  // 2. Resposta perdida seguida de retry (idempotência confirmada no servidor)
  const mockSupabaseCreateIdempotent: SupabaseClientLike = {
    from: mockSupabaseCreateSuccess.from,
    rpc: async (fnName: string, params: any) => {
      return {
        data: {
          success: true,
          idempotent: true,
          activity_id: params.p_activity_id,
          order_number: params.p_order_number,
          server_version: 1,
          message: "Criação já processada anteriormente com sucesso.",
        },
        error: null,
      };
    },
  };

  const resIdempotentCreate = await dispatchCreateActivity(createMutation1, mockSupabaseCreateIdempotent, db);
  assert(
    resIdempotentCreate.success === true && resIdempotentCreate.idempotent === true,
    "5. Retry idempotente de CREATE após perda de resposta é aceito sem duplicar"
  );

  // 3. Conflito por número de OS duplicado retornado pela RPC
  const mockSupabaseCreateConflict: SupabaseClientLike = {
    from: mockSupabaseCreateSuccess.from,
    rpc: async () => ({
      data: {
        success: false,
        conflict: true,
        code: "ORDER_NUMBER_DUPLICATE",
        message: "O número de Nota/OS informado já está cadastrado em outra atividade.",
      },
      error: null,
    }),
  };

  let createConflictThrown: any = null;
  try {
    await dispatchCreateActivity(createMutation1, mockSupabaseCreateConflict, db);
  } catch (err) {
    createConflictThrown = err;
  }
  assert(
    createConflictThrown?.code === "ORDER_NUMBER_DUPLICATE",
    "6. Conflito de negócio (ORDER_NUMBER_DUPLICATE) é lançado com code para tratamento no Sync Engine"
  );

  // 4. Erro Terminal de autorização na RPC (42501 permission denied)
  const mockSupabaseCreateAuthErr: SupabaseClientLike = {
    from: mockSupabaseCreateSuccess.from,
    rpc: async () => ({
      data: null,
      error: { code: "42501", message: "Acesso negado: Você não possui a permissão atividades.criar." },
    }),
  };

  let createAuthErrThrown: any = null;
  try {
    await dispatchCreateActivity(createMutation1, mockSupabaseCreateAuthErr, db);
  } catch (err) {
    createAuthErrThrown = err;
  }
  assert(
    createAuthErrThrown?.code === "42501",
    "7. Erro TERMINAL do PostgreSQL (42501 permission denied) é repassado sem supressão"
  );

  // =========================================================================
  // BLOCO 2: DISPATCHER UPDATE_ACTIVITY
  // =========================================================================
  console.log("\n--- TESTES: DISPATCHER UPDATE_ACTIVITY (OCC E IDEMPOTÊNCIA) ---");

  const actId2 = crypto.randomUUID();
  const idempotencyKey2 = crypto.randomUUID();

  // Atividade local inicializada com localVersion = 1
  const localAct2: LocalActivityRecord = {
    id: actId2,
    orderNumber: "OS-6B-002",
    name: "Pintura Tubulação Bloco A",
    serviceType: "Pintura Geral",
    description: "Pintura de tubulação industrial bloco A",
    status: "em_andamento",
    priority: "media",
    progressPercentage: 20,
    tags: [],
    location: { area: "Bloco A", local: "Piso 1", equipment: "Tubulação" },
    schedule: { plannedStartDate: "2026-10-02", plannedEndDate: "2026-10-06" },
    plannedMaterials: [],
    consumptions: [],
    history: [],
    syncStatus: "pending",
    localUpdatedAt: new Date().toISOString(),
    localVersion: 2, // baseVersion original era 1, próxima será 2
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.activities.put(localAct2);

  const updateMutation: LocalOutboxQueueRecord = {
    mutationId: crypto.randomUUID(),
    idempotencyKey: idempotencyKey2,
    clientId: "client-6b-test",
    entityType: "activity",
    entityId: actId2,
    operation: "UPDATE_ACTIVITY",
    baseVersion: 2,
    clientTimestamp: new Date().toISOString(),
    payload: {
      activityId: actId2,
      name: "Pintura Tubulação Bloco A (Revisado)",
      location: localAct2.location,
      priority: "alta",
    },
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: new Date().toISOString(),
  };

  let rpcUpdateCalls: Array<Record<string, unknown>> = [];
  const mockSupabaseUpdateSuccess: SupabaseClientLike = {
    from: mockSupabaseCreateSuccess.from,
    rpc: async (fnName: string, params: any) => {
      if (fnName === "sync_update_activity") {
        rpcUpdateCalls.push(params);
        return {
          data: {
            success: true,
            idempotent: false,
            activity_id: params.p_activity_id,
            server_version: 2,
            updated_at: new Date().toISOString(),
          },
          error: null,
        };
      }
      return { data: null, error: new Error("RPC não encontrada") };
    },
  };

  // 1. Sucesso no UPDATE_ACTIVITY com OCC correto
  const resUpdate = await dispatchUpdateActivity(updateMutation, mockSupabaseUpdateSuccess, db);
  assert(resUpdate.success === true, "8. dispatchUpdateActivity executa com sucesso");
  assert(
    rpcUpdateCalls.length === 1 && rpcUpdateCalls[0].p_expected_version === 1,
    "9. Envia p_expected_version correto (versão base anterior) para verificação de OCC"
  );
  assert(
    rpcUpdateCalls[0].p_idempotency_key === idempotencyKey2,
    "10. Envia idempotency_key estável no UPDATE"
  );

  const actAfterUpdate = await db.activities.get(actId2);
  assert(
    actAfterUpdate?.syncStatus === "synced" && actAfterUpdate?.localVersion === 2,
    "11. Reconciliação local no IndexedDB atualiza localVersion para 2 (confirmada pelo servidor)"
  );

  // 2. Conflito de versão (OCC: CONCURRENT_MODIFICATION)
  const mockSupabaseUpdateOccConflict: SupabaseClientLike = {
    from: mockSupabaseCreateSuccess.from,
    rpc: async () => ({
      data: {
        success: false,
        conflict: true,
        code: "CONCURRENT_MODIFICATION",
        current_server_version: 3,
        expected_client_version: 1,
        message: "Conflito de concorrência: a atividade foi modificada por outro usuário.",
      },
      error: null,
    }),
  };

  let updateConflictThrown: any = null;
  try {
    await dispatchUpdateActivity(updateMutation, mockSupabaseUpdateOccConflict, db);
  } catch (err) {
    updateConflictThrown = err;
  }
  assert(
    updateConflictThrown?.code === "CONCURRENT_MODIFICATION",
    "12. Conflito OCC (CONCURRENT_MODIFICATION) é detectado e lançado sem sobrescrever o servidor"
  );

  // 3. Conflito por Atividade Arquivada
  const mockSupabaseUpdateArchivedConflict: SupabaseClientLike = {
    from: mockSupabaseCreateSuccess.from,
    rpc: async () => ({
      data: {
        success: false,
        conflict: true,
        code: "ACTIVITY_ARCHIVED",
        message: "A atividade encontra-se arquivada e não pode ser editada.",
      },
      error: null,
    }),
  };

  let updateArchivedThrown: any = null;
  try {
    await dispatchUpdateActivity(updateMutation, mockSupabaseUpdateArchivedConflict, db);
  } catch (err) {
    updateArchivedThrown = err;
  }
  assert(
    updateArchivedThrown?.code === "ACTIVITY_ARCHIVED",
    "13. Edição em atividade arquivada retorna erro de conflito ACTIVITY_ARCHIVED"
  );

  // =========================================================================
  // BLOCO 3: DISPATCHER CANCEL_ACTIVITY
  // =========================================================================
  console.log("\n--- TESTES: DISPATCHER CANCEL_ACTIVITY (IDEMPOTÊNCIA E REGRAS DE NEGÓCIO) ---");

  const actId3 = crypto.randomUUID();
  const idempotencyKey3 = crypto.randomUUID();

  const localAct3: LocalActivityRecord = {
    id: actId3,
    orderNumber: "OS-6B-003",
    name: "Pintura Estrutura Metálica",
    description: "Pintura anticorrosiva de estrutura metálica",
    status: "cancelada",
    priority: "baixa",
    progressPercentage: 10,
    tags: [],
    location: { area: "Geral", local: "Geral", equipment: "" },
    schedule: { plannedStartDate: "2026-10-03", plannedEndDate: "2026-10-07" },
    consumptions: [],
    history: [],
    syncStatus: "pending",
    localUpdatedAt: new Date().toISOString(),
    localVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.activities.put(localAct3);

  const cancelMutation: LocalOutboxQueueRecord = {
    mutationId: crypto.randomUUID(),
    idempotencyKey: idempotencyKey3,
    clientId: "client-6b-test",
    entityType: "activity",
    entityId: actId3,
    operation: "CANCEL_ACTIVITY",
    baseVersion: 2,
    clientTimestamp: new Date().toISOString(),
    payload: {
      activityId: actId3,
      cancellationReason: "Cancelado por mudança no escopo fabril",
    },
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: new Date().toISOString(),
  };

  let rpcCancelCalls: Array<Record<string, unknown>> = [];
  const mockSupabaseCancelSuccess: SupabaseClientLike = {
    from: mockSupabaseCreateSuccess.from,
    rpc: async (fnName: string, params: any) => {
      if (fnName === "cancel_activity") {
        rpcCancelCalls.push(params);
        return {
          data: {
            success: true,
            idempotent: false,
            activity_id: params.p_activity_id,
            status: "cancelada",
            server_version: 2,
            updated_at: new Date().toISOString(),
          },
          error: null,
        };
      }
      return { data: null, error: new Error("RPC não encontrada") };
    },
  };

  // 1. Sucesso no cancelamento
  const resCancel = await dispatchCancelActivity(cancelMutation, mockSupabaseCancelSuccess, db);
  assert(resCancel.success === true, "14. dispatchCancelActivity cancela atividade com sucesso");
  assert(
    rpcCancelCalls.length === 1 &&
      rpcCancelCalls[0].p_activity_id === actId3 &&
      rpcCancelCalls[0].p_cancellation_reason === "Cancelado por mudança no escopo fabril" &&
      rpcCancelCalls[0].p_idempotency_key === idempotencyKey3,
    "15. Chama cancel_activity com a assinatura real de 3 parâmetros (id, reason, idempotency_key)"
  );

  const actAfterCancel = await db.activities.get(actId3);
  assert(
    actAfterCancel?.status === "cancelada" && actAfterCancel?.syncStatus === "synced",
    "16. Reconciliação local no IndexedDB mantém status='cancelada' e syncStatus='synced'"
  );

  // 2. Cancelamento já realizado (idempotência estruturada sem erro textual)
  const mockSupabaseAlreadyCancelled: SupabaseClientLike = {
    from: mockSupabaseCreateSuccess.from,
    rpc: async () => ({
      data: {
        success: true,
        idempotent: true,
        already_cancelled: true,
        activity_id: actId3,
        status: "cancelada",
        server_version: 2,
        message: "A atividade já se encontra cancelada no servidor.",
      },
      error: null,
    }),
  };

  const resAlreadyCancelled = await dispatchCancelActivity(cancelMutation, mockSupabaseAlreadyCancelled, db);
  assert(
    resAlreadyCancelled.success === true && resAlreadyCancelled.idempotent === true,
    "17. Cancelamento já realizado retorna sucesso idempotente estruturado sem lançar erro"
  );

  // 3. Tentativa de cancelar atividade já concluída (Regra de Negócio CONFLICT)
  const mockSupabaseCancelCompleted: SupabaseClientLike = {
    from: mockSupabaseCreateSuccess.from,
    rpc: async () => ({
      data: {
        success: false,
        conflict: true,
        code: "CANNOT_CANCEL_COMPLETED",
        message: "Não é permitido cancelar uma atividade que já foi concluída.",
      },
      error: null,
    }),
  };

  let cancelCompletedThrown: any = null;
  try {
    await dispatchCancelActivity(cancelMutation, mockSupabaseCancelCompleted, db);
  } catch (err) {
    cancelCompletedThrown = err;
  }
  assert(
    cancelCompletedThrown?.code === "CANNOT_CANCEL_COMPLETED",
    "18. Tentativa de cancelar atividade concluída lança conflito CANNOT_CANCEL_COMPLETED"
  );

  // =========================================================================
  // BLOCO 4: INTEGRAÇÃO COM O SYNC ENGINE (ORQUESTRAÇÃO E MULTI-ENTIDADE)
  // =========================================================================
  console.log("\n--- TESTES: ORQUESTRAÇÃO INTEGRADA DO SYNC ENGINE ---");

  // Limpa a fila da Outbox para o teste integrado
  await db.outboxQueue.clear();

  const entityA = "act-entity-A";
  const entityB = "act-entity-B";

  // Entidade A: Mutação 1 falha com CONFLICT (ex: OCC)
  // Entidade A: Mutação 2 é subsequente (deve ficar bloqueada pelo FIFO da Entidade A)
  // Entidade B: Mutação 1 é de outra entidade (deve sincronizar com sucesso independente do bloqueio de A)

  const mutA1: LocalOutboxQueueRecord = {
    mutationId: "mut-A-1",
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "activity",
    entityId: entityA,
    operation: "UPDATE_ACTIVITY",
    baseVersion: 1,
    clientTimestamp: "2026-09-18T10:00:00Z",
    payload: { name: "A1" },
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: "2026-09-18T10:00:00Z",
  };

  const mutA2: LocalOutboxQueueRecord = {
    mutationId: "mut-A-2",
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "activity",
    entityId: entityA,
    operation: "UPDATE_ACTIVITY",
    baseVersion: 2,
    clientTimestamp: "2026-09-18T10:01:00Z",
    payload: { name: "A2" },
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: "2026-09-18T10:01:00Z",
  };

  const mutB1: LocalOutboxQueueRecord = {
    mutationId: "mut-B-1",
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "activity",
    entityId: entityB,
    operation: "CREATE_ACTIVITY",
    baseVersion: 1,
    clientTimestamp: "2026-09-18T10:00:30Z",
    payload: { name: "B1", orderNumber: "OS-B1" },
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: "2026-09-18T10:00:30Z",
  };

  await db.outboxQueue.bulkPut([mutA1, mutA2, mutB1]);

  // Cadastra atividades correspondentes no db.activities
  await db.activities.bulkPut([
    {
      id: entityA,
      orderNumber: "OS-A",
      name: "Atividade A",
      description: "Descrição da atividade A",
      status: "programada",
      priority: "media",
      progressPercentage: 0,
      tags: [],
      location: { area: "Geral", local: "Geral", equipment: "" },
      schedule: { plannedStartDate: "2026-10-01", plannedEndDate: "2026-10-02" },
      consumptions: [],
      history: [],
      syncStatus: "pending",
      localUpdatedAt: new Date().toISOString(),
      localVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: entityB,
      orderNumber: "OS-B1",
      name: "Atividade B",
      description: "Descrição da atividade B",
      status: "programada",
      priority: "media",
      progressPercentage: 0,
      tags: [],
      location: { area: "Geral", local: "Geral", equipment: "" },
      schedule: { plannedStartDate: "2026-10-01", plannedEndDate: "2026-10-02" },
      consumptions: [],
      history: [],
      syncStatus: "pending",
      localUpdatedAt: new Date().toISOString(),
      localVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  // Mock Supabase que gera CONFLICT em mutA1 e SUCESSO em mutB1
  const mockIntegratedSupabase: SupabaseClientLike = {
    from: mockSupabaseCreateSuccess.from,
    rpc: async (fnName: string, params: any) => {
      if (params.p_activity_id === entityA) {
        return {
          data: {
            success: false,
            conflict: true,
            code: "CONCURRENT_MODIFICATION",
            message: "Versão divergente na entidade A",
          },
          error: null,
        };
      }
      if (params.p_activity_id === entityB) {
        return {
          data: {
            success: true,
            idempotent: false,
            activity_id: entityB,
            order_number: "OS-B1",
            server_version: 1,
          },
          error: null,
        };
      }
      return { data: null, error: new Error("Desconhecido") };
    },
  };

  const integratedDispatcher = createActivitySyncDispatcher(mockIntegratedSupabase, db);
  const engineNet = new MockNetworkWatcher();
  const engineLock = new MockLockManager();
  const engine = new SyncEngine(db, engineLock, engineNet);
  engine.setDispatcher(integratedDispatcher);

  // Executa o ciclo de sincronização
  await engine.triggerSync();

  // Verifica o estado das 3 mutações na fila da Outbox
  const recordA1 = await db.outboxQueue.get("mut-A-1");
  const recordA2 = await db.outboxQueue.get("mut-A-2");
  const recordB1 = await db.outboxQueue.get("mut-B-1");

  assert(
    recordA1?.status === "conflict" && recordA1.errorCode === "CONCURRENT_MODIFICATION",
    "19. Mutação A1 transiciona para 'conflict' devido a CONCURRENT_MODIFICATION"
  );
  assert(
    recordA2?.status === "pending",
    "20. Mutação A2 permanece 'pending' e NÃO ultrapassa A1 (respeita FIFO estrito da Entidade A)"
  );
  assert(
    recordB1?.status === "synced",
    "21. Mutação B1 de outra entidade sincroniza com sucesso ('synced') sem ser bloqueada pelo conflito da Entidade A"
  );

  const actB = await db.activities.get(entityB);
  assert(
    actB?.syncStatus === "synced",
    "22. Atividade B tem seu registro local no IndexedDB reconciliado para syncStatus='synced'"
  );

  db.close();

  console.log("\n==================================================");
  console.log(`RESULTADO DA FASE 6B: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6BTests();
