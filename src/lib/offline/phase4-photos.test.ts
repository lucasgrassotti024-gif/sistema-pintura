import "fake-indexeddb/auto";
import { SistemaPinturaLocalDB } from "./local-db";
import {
  saveOfflinePhotos,
  getOfflineActivityPhotos,
  deleteOfflinePhotos,
} from "./local-photos.service";
import { createOfflineActivity } from "./local-outbox.service";
import { getLocalActivityById } from "./local-cache.service";
import { Activity } from "@/modules/atividades/types/activity.types";

// Mock de URL.createObjectURL para ambiente Node / Testes
if (typeof globalThis.URL.createObjectURL !== "function") {
  globalThis.URL.createObjectURL = (blob: Blob | MediaSource) => {
    return `blob:fake-object-url/${Math.random().toString(36).substring(2, 9)}`;
  };
}

async function runPhase4Tests() {
  console.log("==================================================");
  console.log("BATERIA DE TESTES — FASE 4: FOTOS OFFLINE");
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

  const dbName = "Phase4_TestDB_" + Date.now();
  const db = new SistemaPinturaLocalDB(dbName);
  await db.open();

  try {
    // 1. Criação de atividade base offline
    const sampleAct: Activity = {
      id: "",
      orderNumber: "OS-OFF-FOTO-01",
      name: "Tratamento Superficial com Jateamento e Primer",
      tags: [{ id: "tag-1", code: "TAG-FOTO" }],
      location: { area: "Área 1", local: "Tanque 10", equipment: "TQ-10" },
      description: "Preparação e aplicação de fotos offline",
      status: "programada",
      priority: "alta",
      progressPercentage: 0,
      schedule: { plannedStartDate: "2026-09-17", plannedEndDate: "2026-09-20" },
      consumptions: [],
      history: [],
      createdAt: "2026-09-17",
      updatedAt: "2026-09-17",
    };

    const createdAct = await createOfflineActivity(sampleAct, "user-offline-1", db);
    assert(
      createdAct.id.length === 36,
      "1. Atividade offline criada com UUID v4 válido de 36 caracteres"
    );

    // 2. Salvar fotos offline (mock de File)
    const dummyBlobContent1 = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // Fake PNG header
    const mockFile1 = new File([dummyBlobContent1], "foto_inspecao_1.png", {
      type: "image/png",
    });

    const dummyBlobContent2 = new Uint8Array([255, 216, 255, 224, 0, 16]); // Fake JPEG header
    const mockFile2 = new File([dummyBlobContent2], "foto_inspecao_2.jpg", {
      type: "image/jpeg",
    });

    const saveResult = await saveOfflinePhotos(
      createdAct.id,
      [mockFile1, mockFile2],
      "Evidências fotográficas da inicialização",
      db
    );

    assert(
      saveResult.success && saveResult.uploadedCount === 2 && saveResult.photoIds.length === 2,
      "2. Duas fotos salvas offline com sucesso no IndexedDB"
    );

    // 3. Verificação de persistência física no store localPhotoBlobs
    const storedBlobs = await db.localPhotoBlobs
      .where("activityId")
      .equals(createdAct.id)
      .toArray();

    assert(
      storedBlobs.length === 2,
      "3. Registros de fotos encontrados em db.localPhotoBlobs"
    );

    // 4. Integridade de MIME type, tamanho e formato
    const blob1 = storedBlobs.find((b) => b.filename === "foto_inspecao_1.png");
    const blob2 = storedBlobs.find((b) => b.filename === "foto_inspecao_2.jpg");

    assert(
      Boolean(blob1 && blob1.mimeType === "image/png" && blob1.sizeBytes === mockFile1.size),
      "4.1. Preservação exata de MIME type e tamanho para PNG"
    );
    assert(
      Boolean(blob2 && blob2.mimeType === "image/jpeg" && blob2.sizeBytes === mockFile2.size),
      "4.2. Preservação exata de MIME type e tamanho para JPEG"
    );

    // 5. UUIDs estáveis e syncStatus = "pending"
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert(
      Boolean(blob1 && uuidRegex.test(blob1.id) && blob1.syncStatus === "pending"),
      "5.1. Foto 1 possui UUID v4 estável e syncStatus='pending'"
    );
    assert(
      Boolean(blob2 && uuidRegex.test(blob2.id) && blob2.syncStatus === "pending"),
      "5.2. Foto 2 possui UUID v4 estável e syncStatus='pending'"
    );

    // 6. OutboxQueue: Contém referência às fotos mas NUNCA Blobs no payload
    const outboxPhotoEntry = await db.outboxQueue
      .where("entityId")
      .equals(createdAct.id)
      .and((m) => m.entityType === "photo")
      .first();

    assert(
      Boolean(outboxPhotoEntry && outboxPhotoEntry.photoBlobIds?.length === 2),
      "6.1. Entrada na Outbox registrada com referências photoBlobIds"
    );

    const payloadString = JSON.stringify(outboxPhotoEntry?.payload || {});
    const hasNoBlobInPayload =
      !payloadString.includes("Blob") &&
      !payloadString.includes("ArrayBuffer") &&
      !(outboxPhotoEntry?.payload?.file instanceof File);

    assert(
      hasNoBlobInPayload,
      "6.2. CRÍTICO: Payload da Outbox NÃO contém Blob, File ou ArrayBuffer grande"
    );

    // 7. Consulta de fotos via getOfflineActivityPhotos (gera URLs para visualização imediata)
    const retrievedPhotos = await getOfflineActivityPhotos(createdAct.id, db);
    assert(
      retrievedPhotos.length === 2 && Boolean(retrievedPhotos[0].signedUrl?.startsWith("blob:")),
      "7. Fotos offline recuperadas com Object URLs funcionais para visualização na UI"
    );

    // 8. Visualização via getLocalActivityById (detalhes da atividade offline)
    const actWithPhotos = await getLocalActivityById(createdAct.id, db);
    assert(
      Boolean(actWithPhotos?.photos && actWithPhotos.photos.length === 2),
      "8. Atividade recuperada do cache local inclui suas fotos offline associadas"
    );

    // 9. Remoção de foto offline (syncStatus="pending")
    // Deve remover o Blob localmente e atualizar as referências na Outbox sem acionar chamada remota
    const photoIdToDelete = saveResult.photoIds[0];
    const deleteResult = await deleteOfflinePhotos(createdAct.id, [photoIdToDelete], db);

    assert(
      deleteResult.success && deleteResult.deletedCount === 1,
      "9.1. Exclusão de foto offline executada com sucesso"
    );

    const blobAfterDelete = await db.localPhotoBlobs.get(photoIdToDelete);
    assert(
      blobAfterDelete === undefined,
      "9.2. Foto física excluída com sucesso de db.localPhotoBlobs"
    );

    const remainingPhotos = await getOfflineActivityPhotos(createdAct.id, db);
    assert(
      remainingPhotos.length === 1 && remainingPhotos[0].id === saveResult.photoIds[1],
      "9.3. Foto restante preservada intacta no IndexedDB"
    );

    // 10. Validação de bloqueio de arquivos > 5MB
    let rejectedSize = false;
    try {
      const hugeFile = new File([new Uint8Array(6 * 1024 * 1024)], "foto_gigante.jpg", {
        type: "image/jpeg",
      });
      await saveOfflinePhotos(createdAct.id, [hugeFile], undefined, db);
    } catch (err: any) {
      if (err?.message?.includes("5 MB")) {
        rejectedSize = true;
      }
    }
    assert(
      rejectedSize,
      "10. Bloqueio correto de fotos que excedem o limite de 5 MB"
    );

    // 11. Validação de bloqueio de formatos inválidos
    let rejectedFormat = false;
    try {
      const invalidFile = new File([new Uint8Array(100)], "documento.pdf", {
        type: "application/pdf",
      });
      await saveOfflinePhotos(createdAct.id, [invalidFile], undefined, db);
    } catch (err: any) {
      if (err?.message?.includes("formato inválido")) {
        rejectedFormat = true;
      }
    }
    assert(
      rejectedFormat,
      "11. Bloqueio correto de formatos não suportados (permitido: JPG, PNG, WEBP)"
    );

  } finally {
    await db.delete();
  }

  console.log("==================================================");
  console.log(`RESULTADO FINAL DA FASE 4: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error("Erro fatal nos testes da Fase 4:", err);
  process.exit(1);
});
