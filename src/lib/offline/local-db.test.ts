import "fake-indexeddb/auto";
import { SistemaPinturaLocalDB } from "./local-db";
import {
  LocalActivityRecord,
  LocalMaterialRecord,
  LocalOutboxQueueRecord,
  LocalPhotoBlobRecord,
  LocalAuthCacheRecord,
} from "./local-db.types";
import {
  atomicSaveActivityWithOutbox,
  getOrCreateSyncMetadata,
  updateSyncMetadata,
} from "./local-db.helpers";

async function runUnitTests() {
  console.log("==================================================");
  console.log("INICIANDO BATERIA DE TESTES DO DEXIE / INDEXEDDB");
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

  const dbName = "TestSistemaPinturaDB_" + Date.now();
  let db = new SistemaPinturaLocalDB(dbName);

  try {
    // 1. Criação do Banco
    await db.open();
    assert(db.isOpen(), "1. Criação e abertura do banco IndexedDB");

    // 2. Criação de atividade local
    const sampleActivity: LocalActivityRecord = {
      id: "act-test-01",
      orderNumber: "OS-TEST-999",
      name: "Pintura de Tanque Teste",
      tags: [{ id: "tag-1", code: "TQ-99" }],
      location: { area: "Área 1", local: "Tanques", equipment: "TQ-99" },
      description: "Teste unitário de banco local",
      status: "planejada",
      priority: "alta",
      progressPercentage: 0,
      schedule: {
        plannedStartDate: "2026-09-16",
        plannedEndDate: "2026-09-20",
      },
      consumptions: [],
      history: [],
      syncStatus: "pending",
      localUpdatedAt: new Date().toISOString(),
      localVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.activities.put(sampleActivity);
    const count = await db.activities.count();
    assert(count === 1, "2. Criação de atividade local");

    // 3. Leitura de atividade
    const fetchedAct = await db.activities.get("act-test-01");
    assert(
      fetchedAct?.orderNumber === "OS-TEST-999" && fetchedAct.name === "Pintura de Tanque Teste",
      "3. Leitura de atividade local pelo ID"
    );

    // 4. Atualização de atividade
    await db.activities.update("act-test-01", {
      progressPercentage: 50,
      syncStatus: "pending",
      localUpdatedAt: new Date().toISOString(),
    });
    const updatedAct = await db.activities.get("act-test-01");
    assert(
      updatedAct?.progressPercentage === 50 && updatedAct?.syncStatus === "pending",
      "4. Atualização de atividade local"
    );

    // 5. Exclusão de atividade local
    await db.activities.delete("act-test-01");
    const afterDelete = await db.activities.get("act-test-01");
    assert(afterDelete === undefined, "5. Exclusão de atividade local");

    // 6. Criação de material
    const sampleMaterial: LocalMaterialRecord = {
      id: "mat-test-01",
      code: "TINTA-PU-01",
      name: "Tinta Poliuretano Industrial",
      type: "Acabamento PU",
      unit: "L",
      currentStock: 120,
      minimumStock: 40,
      active: true,
      status: "adequado",
      consumptionPerM2PerCoat: 0.15,
      packageType: "Galão",
      packageVolume: 3.6,
      syncStatus: "synced",
      localUpdatedAt: new Date().toISOString(),
    };
    await db.materials.put(sampleMaterial);
    const fetchedMat = await db.materials.get("mat-test-01");
    assert(
      fetchedMat?.currentStock === 120 && fetchedMat?.consumptionPerM2PerCoat === 0.15,
      "6. Criação e consulta de material com atributos técnicos"
    );

    // 7. Armazenamento de Blob
    const testContent = "Simulação de conteúdo binário de foto industrial";
    const testBlob = new Blob([testContent], { type: "image/jpeg" });
    const samplePhotoBlob: LocalPhotoBlobRecord = {
      id: "photo-test-01",
      activityId: "act-test-photo",
      blob: testBlob,
      mimeType: "image/jpeg",
      filename: "inspecao_tanque.jpg",
      sizeBytes: testBlob.size,
      observation: "Registro teste",
      createdAt: new Date().toISOString(),
      syncStatus: "pending",
    };
    await db.localPhotoBlobs.put(samplePhotoBlob);
    assert((await db.localPhotoBlobs.count()) === 1, "7. Armazenamento de Blob no IndexedDB");

    // 8. Recuperação de Blob
    const fetchedPhoto = await db.localPhotoBlobs.get("photo-test-01");
    const retrievedText = await fetchedPhoto?.blob.text();
    assert(
      fetchedPhoto?.sizeBytes === testBlob.size &&
        fetchedPhoto?.mimeType === "image/jpeg" &&
        retrievedText === testContent,
      "8. Recuperação íntegra de Blob e metadados"
    );

    // 9. Criação de item na outbox
    const sampleOutbox: LocalOutboxQueueRecord = {
      mutationId: "mut-test-01",
      idempotencyKey: "idemp-test-abc",
      clientId: "client-test-device",
      entityType: "activity",
      entityId: "act-test-02",
      operation: "CREATE",
      clientTimestamp: new Date().toISOString(),
      payload: { name: "Nova Atividade Offline" },
      status: "pending",
      retryCount: 0,
      maxRetries: 5,
      createdAt: new Date().toISOString(),
    };
    await db.outboxQueue.put(sampleOutbox);
    const fetchedOutbox = await db.outboxQueue.get("mut-test-01");
    assert(fetchedOutbox?.status === "pending", "9. Criação de item na Outbox");

    // 10. Atualização de status da outbox
    await db.outboxQueue.update("mut-test-01", {
      status: "failed",
      errorCode: "STOCK_EXCEEDED",
      errorMessage: "Saldo insuficiente",
      retryCount: 1,
    });
    const updatedOutbox = await db.outboxQueue.get("mut-test-01");
    assert(
      updatedOutbox?.status === "failed" && updatedOutbox?.errorCode === "STOCK_EXCEEDED",
      "10. Atualização de status e erro na Outbox"
    );

    // 11. Criação / leitura de auth_cache
    const sampleAuth: LocalAuthCacheRecord = {
      userId: "user-test-uuid",
      profile: {
        id: "user-test-uuid",
        fullName: "Operador Teste",
        email: "operador@rss3.com.br",
        role: "operador",
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      permissions: ["atividades.visualizar", "atividades.criar"],
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    await db.authCache.put(sampleAuth);
    const fetchedAuth = await db.authCache.get("user-test-uuid");
    assert(
      fetchedAuth?.profile.fullName === "Operador Teste" &&
        fetchedAuth.permissions.includes("atividades.criar"),
      "11. Criação e leitura de auth_cache"
    );

    // 12. Criação / leitura de sync_metadata
    const metadata = await getOrCreateSyncMetadata(db);
    assert(
      metadata.schemaVersion === 1 && typeof metadata.clientId === "string",
      "12. Criação e leitura de sync_metadata com clientId estável"
    );

    await updateSyncMetadata({ lastActivitiesSync: "2026-09-16T12:00:00Z" }, db);
    const updatedMetadata = await getOrCreateSyncMetadata(db);
    assert(
      updatedMetadata.lastActivitiesSync === "2026-09-16T12:00:00Z",
      "12b. Atualização de sync_metadata"
    );

    // 13. Transação local envolvendo múltiplas tabelas (Atividade + Outbox + Foto)
    const txActivity: LocalActivityRecord = {
      id: "act-tx-01",
      orderNumber: "OS-TX-01",
      name: "Atividade com Transação",
      tags: [],
      location: { area: "Área 2", local: "Oficina", equipment: "EQ-1" },
      description: "Teste atômico",
      status: "em_andamento",
      priority: "media",
      progressPercentage: 20,
      schedule: {
        plannedStartDate: "2026-09-16",
        plannedEndDate: "2026-09-18",
      },
      consumptions: [],
      history: [],
      syncStatus: "pending",
      localUpdatedAt: new Date().toISOString(),
      localVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const txOutbox: LocalOutboxQueueRecord = {
      mutationId: "mut-tx-01",
      idempotencyKey: "idemp-tx-01",
      clientId: "client-test-device",
      entityType: "activity",
      entityId: "act-tx-01",
      operation: "CREATE",
      clientTimestamp: new Date().toISOString(),
      payload: { id: "act-tx-01" },
      status: "pending",
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
    };

    const txPhoto: LocalPhotoBlobRecord = {
      id: "photo-tx-01",
      activityId: "act-tx-01",
      blob: new Blob(["foto-tx"], { type: "image/png" }),
      mimeType: "image/png",
      filename: "foto_tx.png",
      sizeBytes: 7,
      createdAt: new Date().toISOString(),
      syncStatus: "pending",
    };

    await atomicSaveActivityWithOutbox(
      {
        activity: txActivity,
        outboxEntry: txOutbox,
        photoBlobs: [txPhoto],
      },
      db
    );

    const checkAct = await db.activities.get("act-tx-01");
    const checkOut = await db.outboxQueue.get("mut-tx-01");
    const checkPhoto = await db.localPhotoBlobs.get("photo-tx-01");

    assert(
      checkAct !== undefined && checkOut !== undefined && checkPhoto !== undefined,
      "13. Transação atômica multi-tabela (Atividade + Outbox + Foto Blob)"
    );

    // 14. Persistência após reload / reabertura do banco (Fechamento e reabertura real da conexão)
    console.log("Fechando conexão do banco...");
    db.close();

    console.log("Reabrindo nova instância do mesmo banco...");
    const reopenedDb = new SistemaPinturaLocalDB(dbName);
    await reopenedDb.open();

    const persistedAct = await reopenedDb.activities.get("act-tx-01");
    const persistedPhoto = await reopenedDb.localPhotoBlobs.get("photo-tx-01");
    const persistedBlobContent = await persistedPhoto?.blob.text();

    assert(
      persistedAct?.name === "Atividade com Transação" &&
        persistedPhoto?.filename === "foto_tx.png" &&
        persistedPhoto?.mimeType === "image/png" &&
        persistedBlobContent === "foto-tx",
      "14. Persistência de dados e Blob após fechar e reabrir a conexão do IndexedDB"
    );

    reopenedDb.close();
  } catch (err) {
    console.error("Erro inesperado durante a execução dos testes:", err);
    failed++;
  }

  console.log("==================================================");
  console.log(`RESULTADO FINAL: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runUnitTests();
