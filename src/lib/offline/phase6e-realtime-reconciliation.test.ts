import "fake-indexeddb/auto";
import { SistemaPinturaLocalDB } from "./local-db";
import { RealtimeReconcilerService } from "./realtime-reconciler.service";
import { OfflineCatchUpService } from "./offline-catchup.service";
import { LocalActivityRecord, LocalOutboxQueueRecord, LocalMaterialRecord } from "./local-db.types";
import { Activity } from "@/modules/atividades/types/activity.types";
import { Material } from "@/modules/materiais/types/material.types";
import { NotificationItem } from "@/modules/notificacoes/types/notification.types";
import { SupabaseClientLike } from "./sync-engine/dispatchers/create-activity.dispatcher";

// Helper para instanciar atividade base de testes
function makeTestActivity(overrides: Partial<LocalActivityRecord> & { id: string; orderNumber: string }): LocalActivityRecord {
  const now = new Date().toISOString();
  return {
    id: overrides.id,
    orderNumber: overrides.orderNumber,
    name: overrides.name || "Atividade de Teste",
    serviceType: overrides.serviceType || "Pintura",
    description: overrides.description || "Descrição de teste",
    status: overrides.status || "programada",
    priority: overrides.priority || "media",
    tags: overrides.tags || [],
    location: overrides.location || { area: "Área Geral", local: "Local 1", equipment: "EQ-1" },
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

async function runPhase6ETests() {
  console.log("==================================================");
  console.log("BATERIA DE TESTES — FASE 6E: REALTIME, CATCH-UP E RECONCILIAÇÃO OFFLINE");
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

  // 1. Realtime INSERT sem mutation
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_1_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);

    const act: any = {
      id: "act-insert-001",
      orderNumber: "OS-INS-01",
      name: "Atividade Realtime Insert",
      serviceType: "Pintura",
      description: "Nova atividade criada remotamente",
      status: "programada",
      priority: "media",
      tags: [],
      location: { area: "Área 1", local: "Tanque 1", equipment: "TQ-1" },
      schedule: { plannedStartDate: "2026-09-01", plannedEndDate: "2026-09-10" },
      progressPercentage: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const res = await reconciler.reconcileActivityUpsert(act, "INSERT");
    const local = await db.activities.get("act-insert-001");

    assert(
      res.applied === true &&
      local?.id === "act-insert-001" &&
      local?.syncStatus === "synced" &&
      local?.localVersion === 1,
      "1. Realtime INSERT sem mutation: gravado com sucesso no IndexedDB como synced"
    );
    await db.close();
  }

  // 2. Realtime UPDATE sem mutation
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_2_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);

    await db.activities.put(
      makeTestActivity({
        id: "act-update-001",
        orderNumber: "OS-UPD-01",
        name: "Atividade Versão 1",
        localVersion: 1,
      })
    );

    const remoteUpdate: any = {
      id: "act-update-001",
      orderNumber: "OS-UPD-01",
      name: "Atividade Versão 2 (Atualizada)",
      serviceType: "Pintura",
      description: "Descrição nova",
      status: "em_andamento",
      priority: "alta",
      tags: [],
      location: { area: "Área 1", local: "Tanque 1", equipment: "TQ-1" },
      schedule: { plannedStartDate: "2026-09-01", plannedEndDate: "2026-09-10" },
      progressPercentage: 40,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 2,
    };

    const res = await reconciler.reconcileActivityUpsert(remoteUpdate, "UPDATE");
    const local = await db.activities.get("act-update-001");

    assert(
      res.applied === true &&
      local?.name === "Atividade Versão 2 (Atualizada)" &&
      local?.localVersion === 2 &&
      local?.syncStatus === "synced",
      "2. Realtime UPDATE sem mutation: atualiza o IndexedDB e avança a versão local"
    );
    await db.close();
  }

  // 3. Realtime DELETE sem mutation
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_3_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);

    await db.activities.put(
      makeTestActivity({
        id: "act-del-001",
        orderNumber: "OS-DEL-01",
      })
    );

    const res = await reconciler.reconcileActivityDelete("act-del-001");
    const local = await db.activities.get("act-del-001");

    assert(
      res.applied === true && local === undefined,
      "3. Realtime DELETE sem mutation: remove o registro do IndexedDB com segurança"
    );
    await db.close();
  }

  // 4. Realtime UPDATE com mutation pendente (NÃO sobrescreve!)
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_4_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-pending-001";

    // Atividade local pendente com progresso 60%
    await db.activities.put(
      makeTestActivity({
        id: actId,
        orderNumber: "OS-PEND-01",
        name: "Nome Editado Offline",
        progressPercentage: 60,
        syncStatus: "pending",
        localVersion: 3,
      })
    );

    // Mutation correspondente na Outbox
    await db.outboxQueue.put({
      mutationId: "mut-pend-001",
      idempotencyKey: "fixed-key-pend-001",
      clientId: "client-test",
      entityType: "activity",
      entityId: actId,
      operation: "UPDATE_ACTIVITY",
      payload: { name: "Nome Editado Offline", progressPercentage: 60 },
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    // Realtime do servidor chega com versão 4
    const remoteUpdate: any = {
      id: actId,
      orderNumber: "OS-PEND-01",
      name: "Alteração de Outro Dispositivo",
      progressPercentage: 20,
      version: 4,
    };

    const res = await reconciler.reconcileActivityUpsert(remoteUpdate, "UPDATE");
    const local = await db.activities.get(actId);
    const outbox = await db.outboxQueue.get("mut-pend-001");

    assert(
      res.applied === false &&
      res.reason === "mutation_pending" &&
      local?.name === "Nome Editado Offline" &&
      local?.progressPercentage === 60 &&
      local?.syncStatus === "pending" &&
      outbox?.status === "pending" &&
      outbox?.idempotencyKey === "fixed-key-pend-001",
      "4. Realtime UPDATE com mutation pendente: REJEITA sobrescrita e preserva estado e Outbox intactos"
    );
    await db.close();
  }

  // 5. Realtime DELETE com mutation pendente (NÃO apaga registro local nem Outbox!)
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_5_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-del-pending-001";

    await db.activities.put(
      makeTestActivity({
        id: actId,
        orderNumber: "OS-DEL-PEND-01",
        syncStatus: "pending",
      })
    );

    await db.outboxQueue.put({
      mutationId: "mut-del-pend-001",
      idempotencyKey: "key-del-pend",
      clientId: "client-test",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 50 },
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    const res = await reconciler.reconcileActivityDelete(actId);
    const local = await db.activities.get(actId);
    const outbox = await db.outboxQueue.get("mut-del-pend-001");

    assert(
      res.applied === false &&
      res.reason === "mutation_pending" &&
      local !== undefined &&
      outbox !== undefined,
      "5. Realtime DELETE com mutation pendente: NÃO apaga atividade nem mutation na Outbox"
    );
    await db.close();
  }

  // 6. Mutation local preservada integralmente (integridade de campos)
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_6_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-intact-001";

    await db.activities.put(
      makeTestActivity({
        id: actId,
        orderNumber: "OS-INTACT-01",
        description: "Descrição Offline Crucial",
        syncStatus: "pending",
      })
    );

    await db.outboxQueue.put({
      mutationId: "mut-intact-001",
      idempotencyKey: "key-intact-777",
      clientId: "client-test",
      entityType: "activity",
      entityId: actId,
      operation: "UPDATE_ACTIVITY",
      payload: { description: "Descrição Offline Crucial" },
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    await reconciler.reconcileActivityUpsert({ id: actId, description: "Servidor sobrescreveu", version: 10 } as any, "UPDATE");
    const local = await db.activities.get(actId);

    assert(
      local?.description === "Descrição Offline Crucial",
      "6. Mutation local preservada integralmente contra eventos Realtime concorrentes"
    );
    await db.close();
  }

  // 7. IdempotencyKey preservada
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_7_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-key-001";

    await db.outboxQueue.put({
      mutationId: "mut-key-001",
      idempotencyKey: "stable-uuid-999",
      clientId: "client-test",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 80 },
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    await reconciler.reconcileActivityUpsert({ id: actId, version: 5 } as any, "UPDATE");
    const outbox = await db.outboxQueue.get("mut-key-001");

    assert(
      outbox?.idempotencyKey === "stable-uuid-999",
      "7. IdempotencyKey preservada e inalterada após recebimento de evento Realtime"
    );
    await db.close();
  }

  // 8. Payload preservado
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_8_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-payload-001";

    await db.outboxQueue.put({
      mutationId: "mut-payload-001",
      idempotencyKey: "stable-uuid-888",
      clientId: "client-test",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 95, consumptions: [{ custom_material_name: "Verniz", quantity: 3, unit: "L" }] },
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });

    await reconciler.reconcileActivityUpsert({ id: actId, version: 6 } as any, "UPDATE");
    const outbox = await db.outboxQueue.get("mut-payload-001");
    const cons = outbox?.payload.consumptions as any[];

    assert(
      outbox?.payload.newProgress === 95 && cons[0].quantity === 3,
      "8. Payload preservado rigorosamente na Outbox sem contaminação pelo evento Realtime"
    );
    await db.close();
  }

  // 9. Versão remota maior sem mutation (aplica)
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_9_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-v-higher";

    await db.activities.put(
      makeTestActivity({
        id: actId,
        orderNumber: "OS-VH",
        name: "Versão 2",
        localVersion: 2,
      })
    );

    const res = await reconciler.reconcileActivityUpsert(
      { id: actId, orderNumber: "OS-VH", name: "Versão 5", version: 5 } as any,
      "UPDATE"
    );
    const local = await db.activities.get(actId);

    assert(
      res.applied === true && local?.localVersion === 5 && local?.name === "Versão 5",
      "9. Versão remota maior sem mutation: aplica atualização e sincroniza localVersion com server"
    );
    await db.close();
  }

  // 10. Versão remota menor sem retrocesso
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_10_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-v-lower";

    await db.activities.put(
      makeTestActivity({
        id: actId,
        orderNumber: "OS-VL",
        name: "Versão 5 Já Confirmada",
        localVersion: 5,
      })
    );

    // Evento obsoleto/atrasado de rede com versão 3
    const res = await reconciler.reconcileActivityUpsert(
      { id: actId, orderNumber: "OS-VL", name: "Versão 3 Antiga", version: 3 } as any,
      "UPDATE"
    );
    const local = await db.activities.get(actId);

    assert(
      res.applied === false &&
      res.reason === "version_not_newer" &&
      local?.localVersion === 5 &&
      local?.name === "Versão 5 Já Confirmada",
      "10. Versão remota menor sem retrocesso: descarta evento obsoleto e não retrocede estado local"
    );
    await db.close();
  }

  // 11. RPC confirmada + Realtime duplicado (idempotente)
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_11_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-dup-001";

    // Simula estado após o Sync Engine já ter confirmado a RPC e atualizado para synced v4
    await db.activities.put(
      makeTestActivity({
        id: actId,
        orderNumber: "OS-DUP",
        progressPercentage: 100,
        status: "concluida",
        localVersion: 4,
        syncStatus: "synced",
      })
    );

    // Realtime broadcast da mesma alteração chega em seguida
    const res = await reconciler.reconcileActivityUpsert(
      { id: actId, orderNumber: "OS-DUP", progressPercentage: 100, status: "concluida", version: 4 } as any,
      "UPDATE"
    );
    const local = await db.activities.get(actId);

    assert(
      res.applied === true &&
      local?.progressPercentage === 100 &&
      local?.syncStatus === "synced",
      "11. RPC confirmada + Realtime duplicado: processa de forma segura e idempotente sem inconsistências"
    );
    await db.close();
  }

  // 12. Realtime chegando antes da resposta da RPC
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_12_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-race-001";

    // Mutation está em estado 'syncing' no Sync Engine
    await db.outboxQueue.put({
      mutationId: "mut-race-001",
      idempotencyKey: "key-race",
      clientId: "client-test",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 70 },
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "syncing",
      retryCount: 0,
      maxRetries: 5,
    });

    await db.activities.put(
      makeTestActivity({
        id: actId,
        orderNumber: "OS-RACE",
        progressPercentage: 70,
        syncStatus: "pending",
      })
    );

    // O Realtime do PostgreSQL chega antes do retorno do HTTP fetch da RPC
    const res = await reconciler.reconcileActivityUpsert(
      { id: actId, orderNumber: "OS-RACE", progressPercentage: 70, version: 3 } as any,
      "UPDATE"
    );

    const local = await db.activities.get(actId);
    const outbox = await db.outboxQueue.get("mut-race-001");

    assert(
      res.applied === false &&
      res.reason === "mutation_pending" &&
      outbox?.status === "syncing",
      "12. Realtime antes da resposta da RPC: Outbox em estado 'syncing' protege a transação em andamento"
    );
    await db.close();
  }

  // 13. Realtime chegando depois da resposta da RPC
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_13_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-post-rpc";

    // RPC já concluiu: outbox marcada como 'synced'
    await db.outboxQueue.put({
      mutationId: "mut-post-rpc",
      idempotencyKey: "key-post",
      clientId: "client-test",
      entityType: "activity",
      entityId: actId,
      operation: "PROGRESS_UPDATE",
      payload: { newProgress: 100 },
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "synced",
      retryCount: 0,
      maxRetries: 5,
    });

    await db.activities.put(
      makeTestActivity({
        id: actId,
        orderNumber: "OS-POST",
        progressPercentage: 100,
        localVersion: 5,
        syncStatus: "synced",
      })
    );

    // Realtime chega posteriormente
    const res = await reconciler.reconcileActivityUpsert(
      { id: actId, orderNumber: "OS-POST", progressPercentage: 100, version: 5 } as any,
      "UPDATE"
    );

    assert(
      res.applied === true,
      "13. Realtime depois da resposta da RPC: mutação já sincronizada permite reconciliação sem bloqueios"
    );
    await db.close();
  }

  // 14. Duas alterações remotas consecutivas
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_14_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-consec-001";

    await db.activities.put(makeTestActivity({ id: actId, orderNumber: "OS-C", localVersion: 1 }));

    // 1ª alteração remota: versão 2
    await reconciler.reconcileActivityUpsert(
      { id: actId, orderNumber: "OS-C", name: "Passo 1", version: 2 } as any,
      "UPDATE"
    );
    // 2ª alteração remota: versão 3
    await reconciler.reconcileActivityUpsert(
      { id: actId, orderNumber: "OS-C", name: "Passo 2", version: 3 } as any,
      "UPDATE"
    );

    const local = await db.activities.get(actId);
    assert(
      local?.name === "Passo 2" && local?.localVersion === 3,
      "14. Duas alterações remotas consecutivas: aplicadas em ordem sequencial com avanço de versão"
    );
    await db.close();
  }

  // 15. Canal Realtime desconectado (preparação de catch-up)
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_15_" + Date.now());
    await db.open();
    const catchup = new OfflineCatchUpService(db);
    assert(typeof catchup.executeCatchUp === "function", "15. Canal Realtime desconectado: serviço de catch-up disponível para recuperação");
    await db.close();
  }

  // 16. Catch-up após reconexão
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_16_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const catchup = new OfflineCatchUpService(db, reconciler);

    const mockSupabase: SupabaseClientLike = {
      from: (table: string) => {
        if (table === "activities") {
          return {
            select: () => ({
              order: () => ({
                range: async () => ({
                  data: [
                    {
                      id: "act-catchup-001",
                      order_number: "OS-CATCH-01",
                      name: "Atividade Pós-Reconexão",
                      service_type: "Pintura",
                      description: "Recuperada via catch-up",
                      status: "em_andamento",
                      priority: "media",
                      progress_percentage: 45,
                      updated_at: "2026-09-19T10:00:00.000Z",
                      version: 2,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "materials") {
          return {
            select: () => ({
              order: () => ({
                range: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        return {} as any;
      },
      rpc: async () => ({ data: null, error: null }),
    } as any;

    const stats = await catchup.executeCatchUp(mockSupabase);
    const local = await db.activities.get("act-catchup-001");

    assert(
      stats.activitiesFetched === 1 &&
      stats.activitiesReconciled === 1 &&
      local?.name === "Atividade Pós-Reconexão" &&
      local?.syncStatus === "synced",
      "16. Catch-up após reconexão: busca dados do servidor e reconcilia no IndexedDB"
    );
    await db.close();
  }

  // 17. Alteração remota durante período offline
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_17_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const catchup = new OfflineCatchUpService(db, reconciler);
    const actId = "act-offline-period";

    await db.activities.put(
      makeTestActivity({
        id: actId,
        orderNumber: "OS-OFF",
        name: "Versão Original",
        progressPercentage: 10,
        localVersion: 1,
      })
    );

    const mockSupabase: SupabaseClientLike = {
      from: (table: string) => ({
        select: () => ({
          order: () => ({
            range: async () => ({
              data: table === "activities" ? [
                {
                  id: actId,
                  order_number: "OS-OFF",
                  name: "Atualizado por Colega Offline",
                  service_type: "Pintura",
                  description: "Alterado no servidor",
                  status: "em_andamento",
                  priority: "media",
                  progress_percentage: 50,
                  updated_at: "2026-09-19T11:00:00.000Z",
                  version: 2,
                },
              ] : [],
              error: null,
            }),
          }),
        }),
      }) as any,
      rpc: async () => ({ data: null, error: null }),
    };

    await catchup.executeCatchUp(mockSupabase);
    const local = await db.activities.get(actId);

    assert(
      local?.name === "Atualizado por Colega Offline" &&
      local?.progressPercentage === 50 &&
      local?.localVersion === 2,
      "17. Alteração durante período offline: catch-up atualiza atividade não-conflitante com sucesso"
    );
    await db.close();
  }

  // 18. Duplicação de evento Realtime (idempotência de entrega)
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_18_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const actId = "act-dup-event";

    const eventPayload: any = {
      id: actId,
      orderNumber: "OS-DE",
      name: "Evento Duplo",
      version: 2,
    };

    const first = await reconciler.reconcileActivityUpsert(eventPayload, "UPDATE");
    const second = await reconciler.reconcileActivityUpsert(eventPayload, "UPDATE");
    const count = await db.activities.where("id").equals(actId).count();

    assert(
      first.applied === true && second.applied === true && count === 1,
      "18. Duplicação de evento: reprocessar exatamente o mesmo evento mantém 1 único registro consistente"
    );
    await db.close();
  }

  // 19. Paginação do catch-up
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_19_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const catchup = new OfflineCatchUpService(db, reconciler);

    let rangesCalled: string[] = [];

    const mockSupabase: SupabaseClientLike = {
      from: (table: string) => ({
        select: () => ({
          order: () => ({
            range: async (from: number, to: number) => {
              rangesCalled.push(`${from}-${to}`);
              if (table === "activities") {
                if (from === 0) {
                  // Primeiro lote cheio de 2 itens (batchSize = 2)
                  return {
                    data: [
                      { id: "p1", order_number: "O1", updated_at: "2026-09-19T01:00:00Z", version: 1 },
                      { id: "p2", order_number: "O2", updated_at: "2026-09-19T01:01:00Z", version: 1 },
                    ],
                    error: null,
                  };
                } else if (from === 2) {
                  // Segundo lote final com 1 item (< batchSize)
                  return {
                    data: [
                      { id: "p3", order_number: "O3", updated_at: "2026-09-19T01:02:00Z", version: 1 },
                    ],
                    error: null,
                  };
                }
              }
              return { data: [], error: null };
            },
          }),
        }),
      }) as any,
      rpc: async () => ({ data: null, error: null }),
    };

    const stats = await catchup.executeCatchUp(mockSupabase, { batchSize: 2 });
    assert(
      stats.activitiesFetched === 3 &&
      rangesCalled.includes("0-1") &&
      rangesCalled.includes("2-3"),
      "19. Paginação do catch-up: divide requisições em páginas com offset/limit até consumir todos os registros"
    );
    await db.close();
  }

  // 20. Overlap do catch-up (janela de segurança de 5 min)
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_20_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const catchup = new OfflineCatchUpService(db, reconciler);

    // Registra último sync às 12:00
    await db.syncMetadata.put({
      key: "global_sync_state",
      clientId: "client-test",
      schemaVersion: 1,
      lastActivitiesSync: "2026-09-19T12:00:00.000Z",
      updatedAt: "2026-09-19T12:00:00.000Z",
    });

    let gteQueryParam: string | null = null;
    const mockSupabase: SupabaseClientLike = {
      from: () => ({
        select: () => ({
          order: () => ({
            range: () => ({
              gte: async (_field: string, val: string) => {
                gteQueryParam = val;
                return { data: [], error: null };
              },
            }),
          }),
        }),
      }) as any,
      rpc: async () => ({ data: null, error: null }),
    };

    // Executa catch-up com 5 min de overlap
    await catchup.executeCatchUp(mockSupabase, { overlapMinutes: 5 });

    // 12:00 - 5 minutos = 11:55
    assert(
      gteQueryParam === "2026-09-19T11:55:00.000Z",
      "20. Overlap do catch-up: consulta inclui janela retroativa de 5 minutos antes do último sync"
    );
    await db.close();
  }

  // 21. Checkpoint seguro (baseado no timestamp do servidor)
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_21_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);
    const catchup = new OfflineCatchUpService(db, reconciler);

    const serverTimestamp = "2026-09-19T15:30:45.123Z";

    const mockSupabase: SupabaseClientLike = {
      from: (table: string) => ({
        select: () => ({
          order: () => ({
            range: async () => ({
              data: table === "activities" ? [
                { id: "act-chk", order_number: "O-CHK", updated_at: serverTimestamp, version: 1 },
              ] : [],
              error: null,
            }),
          }),
        }),
      }) as any,
      rpc: async () => ({ data: null, error: null }),
    };

    await catchup.executeCatchUp(mockSupabase);
    const meta = await db.syncMetadata.get("global_sync_state");

    assert(
      meta?.lastActivitiesSync === serverTimestamp,
      "21. Checkpoint seguro: gravado estritamente a partir do updated_at do Postgres retornado pelo servidor"
    );
    await db.close();
  }

  // 22. Material atualizado remotamente
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_22_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);

    const mat: Material = {
      id: "mat-001",
      code: "MAT-01",
      name: "Tinta Poliuretano Branca",
      type: "Tinta",
      unit: "L",
      currentStock: 100,
      minimumStock: 20,
      active: true,
      status: "adequado",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await reconciler.reconcileMaterialUpsert(mat, "INSERT");
    const local = await db.materials.get("mat-001");

    assert(
      res.applied === true &&
      local?.currentStock === 100 &&
      local?.syncStatus === "synced",
      "22. Material atualizado remotamente: reconciliado no IndexedDB com syncStatus = 'synced'"
    );
    await db.close();
  }

  // 23. Estoque atualizado remotamente (autoridade do PostgreSQL)
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_23_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);

    // Estoque inicial local = 100 L
    await db.materials.put({
      id: "mat-stock-001",
      code: "MAT-STK",
      name: "Tinta Epóxi",
      type: "Tinta",
      unit: "L",
      currentStock: 100,
      minimumStock: 20,
      active: true,
      status: "adequado",
      syncStatus: "synced",
      localUpdatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Servidor atualiza estoque para 70 L
    const updatedMat: Material = {
      id: "mat-stock-001",
      code: "MAT-STK",
      name: "Tinta Epóxi",
      type: "Tinta",
      unit: "L",
      currentStock: 70,
      minimumStock: 20,
      active: true,
      status: "adequado",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await reconciler.reconcileMaterialUpsert(updatedMat, "UPDATE");
    const local = await db.materials.get("mat-stock-001");

    assert(
      local?.currentStock === 70,
      "23. Estoque atualizado remotamente: reflete fielmente 70 L no cache local sem cálculos especulativos"
    );
    await db.close();
  }

  // 24. Notificação sem duplicação
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_24_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);

    const notif: NotificationItem = {
      id: "notif-uuid-001",
      eventKey: "act_created_01",
      category: "atividades",
      severity: "info",
      title: "Nova Atividade",
      message: "Atividade programada",
      createdAt: new Date().toISOString(),
      read: false,
    };

    // Reconcilia duas vezes (Realtime + catch-up)
    await reconciler.reconcileNotificationUpsert(notif);
    await reconciler.reconcileNotificationUpsert(notif);

    const count = await db.notifications.where("id").equals("notif-uuid-001").count();
    assert(
      count === 1,
      "24. Notificação duplicada: inserção por Realtime e catch-up mantém exatamente 1 registro no IndexedDB"
    );

    // 24b. Status de Leitura (notification_reads) reconciliado atomicamente
    await reconciler.reconcileNotificationReadStatus("notif-uuid-001", true, "2026-09-19T12:00:00Z");
    const readItem = await db.notifications.get("notif-uuid-001");
    assert(
      readItem?.read === true && readItem?.readAt === "2026-09-19T12:00:00Z",
      "24b. Status de leitura (notification_reads): atualiza read=true e readAt no IndexedDB"
    );

    // 24c. Deleção de notificação
    await reconciler.reconcileNotificationDelete("notif-uuid-001");
    const deletedItem = await db.notifications.get("notif-uuid-001");
    assert(
      deletedItem === undefined,
      "24c. Deleção de notificação: remove do IndexedDB sem recarregar lista"
    );

    await db.close();
  }

  // 25. Isolamento entre entidades
  {
    const db = new SistemaPinturaLocalDB("db_test_6e_25_" + Date.now());
    await db.open();
    const reconciler = new RealtimeReconcilerService(db);

    const actPending = "act-iso-pending";
    const actClean = "act-iso-clean";

    // Entidade 1 tem mutação pendente
    await db.outboxQueue.put({
      mutationId: "mut-iso",
      idempotencyKey: "key-iso",
      clientId: "client-test",
      entityType: "activity",
      entityId: actPending,
      operation: "UPDATE_ACTIVITY",
      payload: { name: "Local Pendente" },
      clientTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
    });
    await db.activities.put(makeTestActivity({ id: actPending, orderNumber: "O-P", name: "Local Pendente", syncStatus: "pending" }));

    // Entidade 2 não tem mutação
    await db.activities.put(makeTestActivity({ id: actClean, orderNumber: "O-C", name: "Limpa", localVersion: 1 }));

    // Ambos recebem evento Realtime
    const res1 = await reconciler.reconcileActivityUpsert({ id: actPending, name: "Remoto 1", version: 2 } as any, "UPDATE");
    const res2 = await reconciler.reconcileActivityUpsert({ id: actClean, name: "Remoto 2 Atualizado", version: 2 } as any, "UPDATE");

    const local1 = await db.activities.get(actPending);
    const local2 = await db.activities.get(actClean);

    assert(
      res1.applied === false &&
      res2.applied === true &&
      local1?.name === "Local Pendente" &&
      local2?.name === "Remoto 2 Atualizado",
      "25. Isolamento entre entidades: pendência na entidade A não impede reconciliação da entidade B"
    );
    await db.close();
  }

  // 26. Reload após reconciliação (persistência física)
  {
    const dbName = "db_test_6e_persist_" + Date.now();
    const db1 = new SistemaPinturaLocalDB(dbName);
    await db1.open();
    const reconciler1 = new RealtimeReconcilerService(db1);

    await reconciler1.reconcileActivityUpsert(
      {
        id: "act-persist-001",
        orderNumber: "OS-PER",
        name: "Atividade Persistida",
        version: 3,
      } as any,
      "INSERT"
    );
    await db1.close();

    // Reabre o banco simulando reload da página
    const db2 = new SistemaPinturaLocalDB(dbName);
    await db2.open();
    const loaded = await db2.activities.get("act-persist-001");

    assert(
      loaded?.name === "Atividade Persistida" &&
      loaded?.localVersion === 3 &&
      loaded?.syncStatus === "synced",
      "26. Reload após reconciliação: dados reconciliados permanecem persistidos e íntegros no IndexedDB"
    );
    await db2.close();
  }

  console.log("==================================================");
  console.log(`RESULTADO DA FASE 6E: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6ETests().catch((err) => {
  console.error("Erro fatal na execução dos testes da Fase 6E:", err);
  process.exit(1);
});
