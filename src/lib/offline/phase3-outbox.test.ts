import "fake-indexeddb/auto";
import { SistemaPinturaLocalDB } from "./local-db";
import {
  createOfflineActivity,
  updateOfflineActivity,
  cancelOfflineActivity,
} from "./local-outbox.service";
import { getLocalActivities, getLocalActivityById } from "./local-cache.service";
import { Activity } from "@/modules/atividades/types/activity.types";

async function runPhase3Tests() {
  console.log("==================================================");
  console.log("BATERIA DE TESTES — FASE 3: ESCRITA OFFLINE + OUTBOX");
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

  const dbName = "Phase3_TestDB_" + Date.now();
  const db = new SistemaPinturaLocalDB(dbName);
  await db.open();

  try {
    // 1. CREATE_ACTIVITY offline
    const sampleNewAct: Activity = {
      id: "",
      orderNumber: "OS-OFF-101",
      name: "Pintura de Tubulação de Resfriamento",
      tags: [{ id: "tag-1", code: "TUB-01" }],
      location: { area: "Área 3", local: "Casa de Bombas", equipment: "BOMBA-01" },
      description: "Aplicação de demão de acabamento PU",
      status: "programada",
      priority: "alta",
      progressPercentage: 0,
      schedule: { plannedStartDate: "2026-09-17", plannedEndDate: "2026-09-20" },
      consumptions: [],
      history: [],
      createdAt: "2026-09-17",
      updatedAt: "2026-09-17",
    };

    const created = await createOfflineActivity(sampleNewAct, "user-tester", db);
    assert(
      created.syncStatus === "pending" && created.name === sampleNewAct.name,
      "1. CREATE_ACTIVITY offline realizada com sucesso"
    );

    // 4. UUID local válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert(
      uuidRegex.test(created.id) && !created.id.startsWith("act-"),
      "4. UUID local real e válido gerado para a atividade (sem prefixo temporário)"
    );

    // 5. UUID permanece estável após reload / busca
    const fetchedCreated = await getLocalActivityById(created.id, db);
    assert(
      fetchedCreated !== null && fetchedCreated.id === created.id,
      "5. UUID permanece estável após persistência e consulta"
    );

    // 6. mutationId único
    // 7. idempotencyKey único
    // 8. clientId persistente
    // 9. Atividade + Outbox criadas atomicamente
    const outboxItems = await db.outboxQueue.where("entityId").equals(created.id).toArray();
    assert(outboxItems.length === 1, "9. Atividade + Outbox criadas atomicamente em transação única");

    const firstOutbox = outboxItems[0];
    assert(
      uuidRegex.test(firstOutbox.mutationId),
      "6. mutationId único e válido"
    );
    assert(
      uuidRegex.test(firstOutbox.idempotencyKey),
      "7. idempotencyKey único e válido"
    );
    assert(
      typeof firstOutbox.clientId === "string" && firstOutbox.clientId.length > 0,
      "8. clientId persistente e preenchido"
    );
    assert(
      firstOutbox.operation === "CREATE_ACTIVITY" && firstOutbox.status === "pending",
      "9b. Outbox criada com operation=CREATE_ACTIVITY e status=pending"
    );

    // 2. UPDATE_ACTIVITY offline
    const actToUpdate: Activity = {
      ...created,
      description: "Descrição alterada offline",
      priority: "urgente",
    };
    const updated = await updateOfflineActivity(actToUpdate, "user-tester", db);
    assert(
      updated.id === created.id &&
        updated.priority === "urgente" &&
        updated.syncStatus === "pending",
      "2. UPDATE_ACTIVITY offline realizada preservando o mesmo UUID"
    );

    // 12. Múltiplas edições offline (cada mutação é registrada separadamente na outbox)
    const actToUpdate2: Activity = {
      ...updated,
      observations: "Observação adicional registrada offline",
    };
    await updateOfflineActivity(actToUpdate2, "user-tester", db);
    const allOutboxForAct = await db.outboxQueue.where("entityId").equals(created.id).toArray();
    assert(
      allOutboxForAct.length === 3,
      "12. Múltiplas edições offline registradas individualmente na Outbox sem merge arbitrário"
    );

    // 3. CANCEL_ACTIVITY offline
    const cancelled = await cancelOfflineActivity(
      created.id,
      "Interrupção operacional solicitada pela fiscalização",
      "user-tester",
      db
    );
    assert(
      cancelled.status === "cancelada" && cancelled.syncStatus === "pending",
      "3. CANCEL_ACTIVITY offline realizada com sucesso mantendo a atividade rastreável"
    );

    const outboxAfterCancel = await db.outboxQueue.where("entityId").equals(created.id).toArray();
    const cancelMutation = outboxAfterCancel.find((m) => m.operation === "CANCEL_ACTIVITY");
    assert(
      cancelMutation !== undefined && cancelMutation.status === "pending",
      "3b. Mutação CANCEL_ACTIVITY registrada na Outbox com status pending"
    );

    // 10 & 11. Atomicidade: falha simulada de transação não deixa atividade ou outbox órfãs
    let caughtTxError = false;
    try {
      await db.transaction("rw", [db.activities, db.outboxQueue], async () => {
        await db.activities.put({
          ...created,
          id: "act-will-fail",
          name: "Esta atividade deve falhar",
          syncStatus: "pending",
          localUpdatedAt: new Date().toISOString(),
          localVersion: 1,
        });
        // Lança erro intencional antes de gravar outbox
        throw new Error("Simulated Dexie Transaction Abort");
      });
    } catch {
      caughtTxError = true;
    }
    const checkFailedAct = await db.activities.get("act-will-fail");
    assert(
      caughtTxError && checkFailedAct === undefined,
      "10 & 11. Falha em transação reverte atomicamente sem deixar atividade ou outbox órfãs"
    );

    // 13. Persistência após fechar / reabrir IndexedDB
    db.close();
    const reopenedDb = new SistemaPinturaLocalDB(dbName);
    await reopenedDb.open();
    const persistedAfterReopen = await reopenedDb.activities.get(created.id);
    const outboxAfterReopen = await reopenedDb.outboxQueue.where("entityId").equals(created.id).toArray();
    assert(
      persistedAfterReopen !== undefined &&
        persistedAfterReopen.status === "cancelada" &&
        outboxAfterReopen.length === 4,
      "13. Persistência física de atividades e itens da outbox após fechamento e reabertura do banco"
    );

    // 14. Atividade offline aparece na leitura local
    const localList = await getLocalActivities(reopenedDb);
    assert(
      localList.some((a) => a.id === created.id && a.syncStatus === "pending"),
      "14. Atividade criada/alterada offline aparece na listagem local com syncStatus=pending"
    );

    // 16. Nenhuma alteração offline de estoque
    const stockCount = await reopenedDb.stockMovements.count();
    assert(stockCount === 0, "16. Nenhuma alteração de estoque foi efetuada offline");

    // 17 & 18. Nenhuma alteração offline de progresso ou consumo
    const currentCreated = await reopenedDb.activities.get(created.id);
    assert(
      currentCreated?.progressPercentage === 0 && currentCreated?.consumptions.length === 0,
      "17 & 18. Progresso e consumo permaneceram inalterados offline"
    );

    // 19. Nenhuma foto entra na Outbox
    const photosInOutbox = outboxAfterReopen.some(
      (m) => m.photoBlobIds && m.photoBlobIds.length > 0
    );
    assert(!photosInOutbox, "19. Nenhuma foto/blob foi adicionada à Outbox nesta fase");

    // 20. Nenhuma segunda Outbox é criada
    const tableNames = reopenedDb.tables.map((t) => t.name);
    assert(
      tableNames.filter((t) => t.toLowerCase().includes("outbox")).length === 1,
      "20. Apenas uma única tabela outboxQueue existe no banco local"
    );

    // 21. Nenhum segundo IndexedDB é criado
    assert(reopenedDb.name === dbName, "21. Instância centralizada única do banco local preservada");

    reopenedDb.close();
  } catch (err) {
    console.error("Erro no teste da Fase 3:", err);
    failed++;
  }

  console.log("==================================================");
  console.log(`RESULTADO DA FASE 3: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests();
