import "fake-indexeddb/auto";
import { SistemaPinturaLocalDB } from "../local-db";
import {
  SyncEngine,
  SyncNetworkWatcher,
  SyncLockManager,
  createActivitySyncDispatcher,
  dispatchPhotoAdd,
  dispatchPhotoDelete,
} from "./index";
import { LocalOutboxQueueRecord, LocalActivityRecord, LocalPhotoBlobRecord } from "../local-db.types";
import { SupabaseClientLike } from "./dispatchers/create-activity.dispatcher";

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

async function runPhase6CTests() {
  console.log("==================================================");
  console.log("BATERIA DE TESTES — FASE 6C: FOTOS OFFLINE NO SYNC ENGINE");
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

  const db = new SistemaPinturaLocalDB("phase6c_test_db_" + Date.now());
  await db.open();

  // =========================================================================
  // BLOCO 1: FOTO OFFLINE SALVA E RECUPERADA NO INDEXEDDB
  // =========================================================================
  console.log("\n--- TESTES: PERSISTÊNCIA E RECUPERAÇÃO DE BLOBS ---");

  const actId1 = crypto.randomUUID();
  const photoRecordId1 = crypto.randomUUID();
  const photoId1 = crypto.randomUUID();
  const photoId2 = crypto.randomUUID();

  // Cria Blob em memória
  const mockBlob1 = new Blob(["conteudo-imagem-png-1"], { type: "image/png" });
  const mockBlob2 = new Blob(["conteudo-imagem-jpg-2"], { type: "image/jpeg" });

  const photoRecord1: LocalPhotoBlobRecord = {
    id: photoId1,
    activityId: actId1,
    photoRecordId: photoRecordId1,
    blob: mockBlob1,
    mimeType: "image/png",
    filename: "foto1.png",
    sizeBytes: mockBlob1.size,
    observation: "Foto 1 do tanque",
    createdAt: new Date().toISOString(),
    syncStatus: "pending",
  };

  const photoRecord2: LocalPhotoBlobRecord = {
    id: photoId2,
    activityId: actId1,
    photoRecordId: photoRecordId1,
    blob: mockBlob2,
    mimeType: "image/jpeg",
    filename: "foto2.jpg",
    sizeBytes: mockBlob2.size,
    observation: "Foto 2 do tanque",
    createdAt: new Date().toISOString(),
    syncStatus: "pending",
  };

  await db.localPhotoBlobs.bulkPut([photoRecord1, photoRecord2]);

  // 1. Validar que os Blobs foram persistidos no store
  const stored1 = await db.localPhotoBlobs.get(photoId1);
  const stored2 = await db.localPhotoBlobs.get(photoId2);
  assert(
    Boolean(stored1 && stored1.blob && stored1.sizeBytes === mockBlob1.size),
    "1. Foto 1 offline e Blob físico persistidos com sucesso no IndexedDB"
  );
  assert(
    Boolean(stored2 && stored2.blob && stored2.mimeType === "image/jpeg"),
    "2. Foto 2 offline recuperada com tipo MIME e integridade preservados"
  );

  // =========================================================================
  // BLOCO 2: DEPENDÊNCIA DE ATIVIDADE (CREATE PENDENTE VS CONFIRMADA)
  // =========================================================================
  console.log("\n--- TESTES: DEPENDÊNCIA DA ATIVIDADE PRINCIPAL ---");

  // Cria atividade local
  const localAct: LocalActivityRecord = {
    id: actId1,
    orderNumber: "OS-PHOTO-001",
    name: "Pintura Tanque 10",
    serviceType: "Pintura",
    description: "Descrição",
    status: "programada",
    priority: "media",
    progressPercentage: 0,
    tags: [],
    location: { area: "Geral", local: "Geral", equipment: "" },
    schedule: { plannedStartDate: "2026-10-01", plannedEndDate: "2026-10-05" },
    consumptions: [],
    history: [],
    syncStatus: "pending",
    localUpdatedAt: new Date().toISOString(),
    localVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.activities.put(localAct);

  // Coloca uma mutação CREATE_ACTIVITY pendente na fila para actId1
  const createActMutation: LocalOutboxQueueRecord = {
    mutationId: "mut-create-act-1",
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "activity",
    entityId: actId1,
    operation: "CREATE_ACTIVITY",
    baseVersion: 1,
    clientTimestamp: "2026-09-18T10:00:00Z",
    payload: { name: "Pintura Tanque 10", orderNumber: "OS-PHOTO-001" },
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: "2026-09-18T10:00:00Z",
  };
  await db.outboxQueue.put(createActMutation);

  // Cria mutação PHOTO_ADD para a mesma atividade
  const photoMutation1: LocalOutboxQueueRecord = {
    mutationId: "mut-photo-1",
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "photo",
    entityId: actId1,
    operation: "PHOTO_ADD",
    clientTimestamp: "2026-09-18T10:01:00Z",
    payload: {
      activityId: actId1,
      photoRecordId: photoRecordId1,
      observation: "Fotos iniciais",
    },
    photoBlobIds: [photoId1, photoId2],
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: "2026-09-18T10:01:00Z",
  };
  await db.outboxQueue.put(photoMutation1);

  // Tenta rodar dispatchPhotoAdd enquanto CREATE_ACTIVITY ainda está pendente
  const mockSupabaseDefault: SupabaseClientLike = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: "new" }, error: null }) }) }),
    }),
    rpc: async () => ({ data: null, error: null }),
  };

  let pendingDependencyErr: any = null;
  try {
    await dispatchPhotoAdd(photoMutation1, mockSupabaseDefault, db);
  } catch (err) {
    pendingDependencyErr = err;
  }
  assert(
    pendingDependencyErr?.code === "ACTIVITY_SYNC_PENDING",
    "3. Atividade ainda pendente na Outbox bloqueia upload da foto com erro controlado RETRYABLE"
  );

  // Verifica que o Blob NÃO foi apagado
  const blobAfterPendingCheck = await db.localPhotoBlobs.get(photoId1);
  assert(
    Boolean(blobAfterPendingCheck && blobAfterPendingCheck.blob),
    "4. Blob local preservado intacto enquanto aguarda a sincronização da atividade"
  );

  // Agora remove a mutação de CREATE (simulando que ela foi sincronizada e concluída)
  await db.outboxQueue.delete(createActMutation.mutationId);
  await db.activities.update(actId1, { syncStatus: "synced" });

  // =========================================================================
  // BLOCO 3: FLUXO COMPLETO DE UPLOAD E CONFIRMAÇÃO
  // =========================================================================
  console.log("\n--- TESTES: UPLOAD NO STORAGE E CONFIRMAÇÃO DE SESSÃO ---");

  const storageUploads: Array<{ path: string; file: any }> = [];
  const rpcPhotoCalls: Array<{ fn: string; params: any }> = [];

  const mockSupabasePhotoSuccess: SupabaseClientLike = {
    from: () => ({}),
    rpc: async (fn: string, params: any) => {
      rpcPhotoCalls.push({ fn, params });
      if (fn === "start_photo_record_session") {
        return {
          data: {
            photo_record_id: params.p_photo_record_id || photoRecordId1,
            activity_id: params.p_activity_id,
            status: "pendente",
            idempotent: false,
          },
          error: null,
        };
      }
      if (fn === "confirm_photo_record_session") {
        return {
          data: {
            photo_record_id: params.p_photo_record_id,
            photos_count: params.p_photos?.length || 0,
            status: "confirmado",
            idempotent: false,
          },
          error: null,
        };
      }
      return { data: null, error: new Error("RPC não mapeada") };
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: any) => {
          storageUploads.push({ path, file });
          return { data: { path }, error: null };
        },
        remove: async (paths: string[]) => ({ data: paths, error: null }),
      }),
    },
  };

  const photoAddResult = await dispatchPhotoAdd(photoMutation1, mockSupabasePhotoSuccess, db);

  assert(photoAddResult.success === true, "5. dispatchPhotoAdd executa com sucesso");
  assert(
    rpcPhotoCalls.some((c) => c.fn === "start_photo_record_session" && c.params.p_photo_record_id === photoRecordId1),
    "6. Sessão iniciada no Supabase reutilizando o photoRecordId local"
  );
  assert(
    storageUploads.length === 2 &&
      storageUploads[0].path === `activities/${actId1}/${photoRecordId1}/${photoId1}.png` &&
      storageUploads[1].path === `activities/${actId1}/${photoRecordId1}/${photoId2}.jpg`,
    "7. Arquivos físicos enviados para o Storage no padrão exato 'activities/{actId}/{recordId}/{photoId}.{ext}'"
  );
  assert(
    rpcPhotoCalls.some((c) => c.fn === "confirm_photo_record_session" && c.params.p_photos?.length === 2),
    "8. confirm_photo_record_session executada com a lista de metadados das 2 fotos enviadas"
  );

  // 9. Remoção dos Blobs APÓS confirmação
  const blob1AfterSuccess = await db.localPhotoBlobs.get(photoId1);
  const blob2AfterSuccess = await db.localPhotoBlobs.get(photoId2);
  assert(
    blob1AfterSuccess === undefined && blob2AfterSuccess === undefined,
    "9. Blobs físicos removidos do IndexedDB SOMENTE após confirmação bem-sucedida da sessão"
  );

  // 10. Reconciliação da atividade local com as fotos confirmadas
  const updatedActWithPhotos = await db.activities.get(actId1);
  assert(
    Boolean(updatedActWithPhotos?.photos && updatedActWithPhotos.photos.length === 2),
    "10. Atividade local reconciliada com as fotos confirmadas salvas no histórico"
  );

  // =========================================================================
  // BLOCO 4: IDEMPOTÊNCIA E RETRY APÓS PERDA DE RESPOSTA
  // =========================================================================
  console.log("\n--- TESTES: IDEMPOTÊNCIA E RETRY DA SESSÃO ---");

  // Recadastra Blob para testar retry com sessão já confirmada no backend
  const retryBlobId = crypto.randomUUID();
  await db.localPhotoBlobs.put({
    id: retryBlobId,
    activityId: actId1,
    photoRecordId: photoRecordId1,
    blob: mockBlob1,
    mimeType: "image/png",
    filename: "retry.png",
    sizeBytes: mockBlob1.size,
    createdAt: new Date().toISOString(),
    syncStatus: "pending",
  });

  const retryPhotoMutation: LocalOutboxQueueRecord = {
    ...photoMutation1,
    mutationId: "mut-retry-photo",
    photoBlobIds: [retryBlobId],
  };

  // Mock Supabase onde start_photo_record_session retorna status='confirmado'
  const mockSupabaseAlreadyConfirmed: SupabaseClientLike = {
    from: () => ({}),
    rpc: async (fn: string, params: any) => {
      if (fn === "start_photo_record_session") {
        return {
          data: {
            photo_record_id: params.p_photo_record_id,
            status: "confirmado",
            idempotent: true,
            message: "Sessão fotográfica já confirmada anteriormente.",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
    storage: mockSupabasePhotoSuccess.storage,
  };

  const retryResult = await dispatchPhotoAdd(retryPhotoMutation, mockSupabaseAlreadyConfirmed, db);
  assert(
    retryResult.success === true && retryResult.idempotent === true,
    "11. Retry de sessão já confirmada é aceito de modo idempotente sem reenviar fotos"
  );

  const retryBlobAfter = await db.localPhotoBlobs.get(retryBlobId);
  assert(
    retryBlobAfter === undefined,
    "12. Blob local é removido com segurança ao confirmar idempotência remota"
  );

  // =========================================================================
  // BLOCO 5: FALHAS PARCIAIS E ROLLBACK SEGURO
  // =========================================================================
  console.log("\n--- TESTES: FALHAS PARCIAIS (UPLOAD OU CONFIRMAÇÃO) ---");

  const failBlobId = crypto.randomUUID();
  const failRecordId = crypto.randomUUID();
  await db.localPhotoBlobs.put({
    id: failBlobId,
    activityId: actId1,
    photoRecordId: failRecordId,
    blob: mockBlob1,
    mimeType: "image/png",
    filename: "fail.png",
    sizeBytes: mockBlob1.size,
    createdAt: new Date().toISOString(),
    syncStatus: "pending",
  });

  const failMutation: LocalOutboxQueueRecord = {
    mutationId: "mut-fail-photo",
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "photo",
    entityId: actId1,
    operation: "PHOTO_ADD",
    clientTimestamp: new Date().toISOString(),
    payload: { activityId: actId1, photoRecordId: failRecordId },
    photoBlobIds: [failBlobId],
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: new Date().toISOString(),
  };

  // Falha 1: Erro durante upload no Storage (ex: queda de rede)
  const mockSupabaseStorageFail: SupabaseClientLike = {
    from: () => ({}),
    rpc: async (fn: string, params: any) => {
      if (fn === "start_photo_record_session") {
        return { data: { photo_record_id: failRecordId, status: "pendente" }, error: null };
      }
      return { data: null, error: null };
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: new Error("Falha na rede durante o upload") }),
        remove: async (paths: string[]) => ({ data: paths, error: null }),
      }),
    },
  };

  let storageErrThrown = false;
  try {
    await dispatchPhotoAdd(failMutation, mockSupabaseStorageFail, db);
  } catch {
    storageErrThrown = true;
  }
  assert(storageErrThrown, "13. Falha de rede durante o upload do arquivo é lançada como erro");

  const blobAfterStorageFail = await db.localPhotoBlobs.get(failBlobId);
  assert(
    Boolean(blobAfterStorageFail && blobAfterStorageFail.blob),
    "14. CRÍTICO: Blob local NÃO é apagado em caso de falha no Storage (preservado para retry)"
  );

  // Falha 2: Upload ok, mas falha na confirmação da RPC
  let abortCalled = false;
  const mockSupabaseConfirmFail: SupabaseClientLike = {
    from: () => ({}),
    rpc: async (fn: string) => {
      if (fn === "start_photo_record_session") {
        return { data: { photo_record_id: failRecordId, status: "pendente" }, error: null };
      }
      if (fn === "confirm_photo_record_session") {
        return { data: null, error: { message: "Erro 500 ao confirmar fotos" } };
      }
      if (fn === "abort_photo_record_session") {
        abortCalled = true;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    storage: mockSupabasePhotoSuccess.storage,
  };

  let confirmErrThrown = false;
  try {
    await dispatchPhotoAdd(failMutation, mockSupabaseConfirmFail, db);
  } catch {
    confirmErrThrown = true;
  }
  assert(confirmErrThrown, "15. Falha na confirmação da sessão dispara exceção");
  assert(abortCalled, "16. Sessão pendente é abortada de forma segura para não deixar sessões órfãs");

  const blobAfterConfirmFail = await db.localPhotoBlobs.get(failBlobId);
  assert(
    Boolean(blobAfterConfirmFail && blobAfterConfirmFail.blob),
    "17. Blob local continua preservado intacto após falha na confirmação da sessão"
  );

  // =========================================================================
  // BLOCO 6: DISPATCHER PHOTO_DELETE
  // =========================================================================
  console.log("\n--- TESTES: DISPATCHER PHOTO_DELETE ---");

  const deletePhotoId = crypto.randomUUID();
  const deleteMutation: LocalOutboxQueueRecord = {
    mutationId: "mut-delete-photo-1",
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "photo",
    entityId: actId1,
    operation: "PHOTO_DELETE",
    clientTimestamp: new Date().toISOString(),
    payload: {
      activityId: actId1,
      photoIds: [deletePhotoId],
    },
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: new Date().toISOString(),
  };

  let deleteRpcCalled = false;
  const mockSupabaseDeleteSuccess: SupabaseClientLike = {
    from: () => ({}),
    rpc: async (fn: string, params: any) => {
      if (fn === "delete_activity_photos") {
        deleteRpcCalled = true;
        return {
          data: {
            success: true,
            deleted_count: 1,
            storage_paths: [`activities/${actId1}/${photoRecordId1}/${deletePhotoId}.jpg`],
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
    storage: mockSupabasePhotoSuccess.storage,
  };

  const delRes = await dispatchPhotoDelete(deleteMutation, mockSupabaseDeleteSuccess, db);
  assert(
    delRes.success === true && deleteRpcCalled,
    "18. dispatchPhotoDelete remove a foto do banco e do Storage com sucesso"
  );

  // =========================================================================
  // BLOCO 7: INTEGRAÇÃO COM O SYNC ENGINE (ROTEAMENTO E ORQUESTRAÇÃO)
  // =========================================================================
  console.log("\n--- TESTES: ORQUESTRAÇÃO INTEGRADA PHOTO_ADD NO SYNC ENGINE ---");

  await db.outboxQueue.clear();

  // Entidade X: Foto pronta para envio
  // Entidade Y: Foto de outra atividade
  const actX = crypto.randomUUID();
  const actY = crypto.randomUUID();

  const blobX = crypto.randomUUID();
  const blobY = crypto.randomUUID();

  await db.localPhotoBlobs.bulkPut([
    {
      id: blobX,
      activityId: actX,
      photoRecordId: crypto.randomUUID(),
      blob: mockBlob1,
      mimeType: "image/png",
      filename: "x.png",
      sizeBytes: mockBlob1.size,
      createdAt: new Date().toISOString(),
      syncStatus: "pending",
    },
    {
      id: blobY,
      activityId: actY,
      photoRecordId: crypto.randomUUID(),
      blob: mockBlob2,
      mimeType: "image/jpeg",
      filename: "y.jpg",
      sizeBytes: mockBlob2.size,
      createdAt: new Date().toISOString(),
      syncStatus: "pending",
    },
  ]);

  await db.activities.bulkPut([
    {
      ...localAct,
      id: actX,
      name: "Atividade X",
      syncStatus: "synced",
    },
    {
      ...localAct,
      id: actY,
      name: "Atividade Y",
      syncStatus: "synced",
    },
  ]);

  const mutPhotoX: LocalOutboxQueueRecord = {
    mutationId: "mut-x",
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "photo",
    entityId: actX,
    operation: "PHOTO_ADD",
    clientTimestamp: "2026-09-18T10:00:00Z",
    payload: { activityId: actX, photoRecordId: crypto.randomUUID() },
    photoBlobIds: [blobX],
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: "2026-09-18T10:00:00Z",
  };

  const mutPhotoY: LocalOutboxQueueRecord = {
    mutationId: "mut-y",
    idempotencyKey: crypto.randomUUID(),
    clientId: "client-test",
    entityType: "photo",
    entityId: actY,
    operation: "PHOTO_ADD",
    clientTimestamp: "2026-09-18T10:00:30Z",
    payload: { activityId: actY, photoRecordId: crypto.randomUUID() },
    photoBlobIds: [blobY],
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: "2026-09-18T10:00:30Z",
  };

  await db.outboxQueue.bulkPut([mutPhotoX, mutPhotoY]);

  const integratedDispatcher = createActivitySyncDispatcher(mockSupabasePhotoSuccess, db);
  const netWatcher = new MockNetworkWatcher();
  const lockMgr = new MockLockManager();
  const engine = new SyncEngine(db, lockMgr, netWatcher);
  engine.setDispatcher(integratedDispatcher);

  await engine.triggerSync();

  const outboxX = await db.outboxQueue.get("mut-x");
  const outboxY = await db.outboxQueue.get("mut-y");

  assert(
    outboxX?.status === "synced",
    "19. PHOTO_ADD roteado corretamente pelo Sync Engine e marcado como 'synced' para Atividade X"
  );
  assert(
    outboxY?.status === "synced",
    "20. PHOTO_ADD da Atividade Y executado com sucesso e independente de X"
  );

  const finalBlobX = await db.localPhotoBlobs.get(blobX);
  const finalBlobY = await db.localPhotoBlobs.get(blobY);
  assert(
    finalBlobX === undefined && finalBlobY === undefined,
    "21. Blobs locais de ambas atividades removidos do IndexedDB após sincronização completa"
  );

  db.close();

  console.log("\n==================================================");
  console.log(`RESULTADO DA FASE 6C: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6CTests();
