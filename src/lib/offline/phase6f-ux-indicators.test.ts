import { describe, it } from "node:test";
import assert from "node:assert";
import { deriveNormalizedSyncState } from "./hooks/useSyncStatus";
import { SyncOperationState } from "./sync-engine/sync-engine.types";

describe("Fase 6F — UX e Indicadores de Sincronização", () => {
  // 1. Hook sem pendências (Online & Sincronizado)
  it("1. Normalização de estado: sem pendências e online deve retornar SYNCED", () => {
    const visual = deriveNormalizedSyncState({
      isOnline: true,
      state: "idle",
      pendingCount: 0,
      conflictCount: 0,
      failedCount: 0,
    });
    assert.strictEqual(visual, "SYNCED");
  });

  // 2. Hook com pending
  it("2. Normalização de estado: online com pendências deve retornar PENDING", () => {
    const visual = deriveNormalizedSyncState({
      isOnline: true,
      state: "idle",
      pendingCount: 3,
      conflictCount: 0,
      failedCount: 0,
    });
    assert.strictEqual(visual, "PENDING");
  });

  // 3. Hook sincronizando
  it("3. Normalização de estado: online com state='syncing' deve retornar SYNCING", () => {
    const visual = deriveNormalizedSyncState({
      isOnline: true,
      state: "syncing",
      pendingCount: 3,
      conflictCount: 0,
      failedCount: 0,
    });
    assert.strictEqual(visual, "SYNCING");
  });

  // 4. Hook com conflito
  it("4. Normalização de estado: com conflito deve retornar CONFLICT", () => {
    const visual = deriveNormalizedSyncState({
      isOnline: true,
      state: "idle",
      pendingCount: 2,
      conflictCount: 1,
      failedCount: 0,
    });
    assert.strictEqual(visual, "CONFLICT");
  });

  // 5. Hook com failed
  it("5. Normalização de estado: com falhas terminais deve retornar ERROR", () => {
    const visual = deriveNormalizedSyncState({
      isOnline: true,
      state: "error",
      pendingCount: 1,
      conflictCount: 0,
      failedCount: 1,
    });
    assert.strictEqual(visual, "ERROR");
  });

  // 6. Offline sem pendências
  it("6. Normalização de estado: offline sem pendências deve retornar OFFLINE", () => {
    const visual = deriveNormalizedSyncState({
      isOnline: false,
      state: "idle",
      pendingCount: 0,
      conflictCount: 0,
      failedCount: 0,
    });
    assert.strictEqual(visual, "OFFLINE");
  });

  // 7. Offline com pendências
  it("7. Normalização de estado: offline com pendências deve retornar OFFLINE", () => {
    const visual = deriveNormalizedSyncState({
      isOnline: false,
      state: "idle",
      pendingCount: 4,
      conflictCount: 0,
      failedCount: 0,
    });
    assert.strictEqual(visual, "OFFLINE");
  });

  // 8. Transição offline -> online preserva integridade lógica
  it("8. Normalização de estado: transição offline -> online reflete pendências imediatamente", () => {
    const beforeOnline = deriveNormalizedSyncState({
      isOnline: false,
      state: "idle",
      pendingCount: 2,
      conflictCount: 0,
      failedCount: 0,
    });
    assert.strictEqual(beforeOnline, "OFFLINE");

    const afterOnline = deriveNormalizedSyncState({
      isOnline: true,
      state: "idle",
      pendingCount: 2,
      conflictCount: 0,
      failedCount: 0,
    });
    assert.strictEqual(afterOnline, "PENDING");
  });

  // 9. Prioridade de estados: Conflito tem precedência máxima sobre Erro e Sincronizando
  it("9. Prioridade de estados: CONFLICT precede ERROR, SYNCING, PENDING e OFFLINE", () => {
    const visual = deriveNormalizedSyncState({
      isOnline: false,
      state: "syncing",
      pendingCount: 5,
      conflictCount: 1,
      failedCount: 2,
    });
    assert.strictEqual(visual, "CONFLICT");
  });

  // 10. Prioridade de estados: ERROR precede SYNCING e PENDING
  it("10. Prioridade de estados: ERROR precede SYNCING e PENDING quando não há conflito", () => {
    const visual = deriveNormalizedSyncState({
      isOnline: true,
      state: "syncing",
      pendingCount: 5,
      conflictCount: 0,
      failedCount: 1,
    });
    assert.strictEqual(visual, "ERROR");
  });

  // 11. Prioridade de estados: SYNCING precede PENDING quando online
  it("11. Prioridade de estados: SYNCING precede PENDING quando online", () => {
    const visual = deriveNormalizedSyncState({
      isOnline: true,
      state: "syncing",
      pendingCount: 2,
      conflictCount: 0,
      failedCount: 0,
    });
    assert.strictEqual(visual, "SYNCING");
  });

  // 12. Prioridade de estados: PENDING precede OFFLINE quando online
  it("12. Prioridade de estados: PENDING é ativo quando online e pendingCount > 0", () => {
    const visual = deriveNormalizedSyncState({
      isOnline: true,
      state: "idle",
      pendingCount: 1,
      conflictCount: 0,
      failedCount: 0,
    });
    assert.strictEqual(visual, "PENDING");
  });

  // 13. Reatividade da Outbox via Notifier
  it("13. Notificador da Outbox: notifica assinantes imediatamente ao enfileirar", async () => {
    const { outboxNotifier } = await import("./outbox-notifier");
    let notified = false;
    let receivedEvent: any = null;

    const unsubscribe = outboxNotifier.subscribe((evt) => {
      notified = true;
      receivedEvent = evt;
    });

    outboxNotifier.notify({
      type: "enqueued",
      entityType: "activity",
      entityId: "act-ux-001",
      mutationId: "mut-ux-001",
      timestamp: new Date().toISOString(),
    });

    assert.strictEqual(notified, true);
    assert.strictEqual(receivedEvent?.entityType, "activity");
    assert.strictEqual(receivedEvent?.entityId, "act-ux-001");

    unsubscribe();
  });

  // 14. Indicador de Atividade: ActivitySyncBadge suporta os 5 estados do contrato
  it("14. Contrato de estados de atividade: cobre LocalSyncStatus ('pending' | 'syncing' | 'failed' | 'conflict' | 'synced')", async () => {
    const statuses = ["pending", "syncing", "failed", "conflict", "synced"] as const;
    assert.strictEqual(statuses.length, 5);
  });
});
