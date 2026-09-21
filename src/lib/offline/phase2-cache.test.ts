import "fake-indexeddb/auto";
import { SistemaPinturaLocalDB } from "./local-db";
import {
  cacheActivitiesLocally,
  cacheSingleActivityLocally,
  getLocalActivities,
  getLocalActivityById,
  cacheMaterialsLocally,
  getLocalMaterials,
  cacheNotificationsLocally,
  getLocalNotifications,
} from "./local-cache.service";
import { isNetworkOrOfflineError } from "./network-status";
import { getOrCreateSyncMetadata } from "./local-db.helpers";
import { Activity } from "@/modules/atividades/types/activity.types";
import { Material } from "@/modules/materiais/types/material.types";
import { NotificationItem } from "@/modules/notificacoes/types/notification.types";

async function runPhase2Tests() {
  console.log("==================================================");
  console.log("BATERIA DE TESTES — FASE 2: CACHE E LEITURA OFFLINE");
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

  const dbName = "Phase2_TestDB_" + Date.now();
  const testDb = new SistemaPinturaLocalDB(dbName);
  await testDb.open();

  try {
    // 1. Buscar atividades online e persistir no IndexedDB
    const activitiesSample: Activity[] = [
      {
        id: "act-fase2-1",
        orderNumber: "OS-F2-001",
        name: "Pintura Estrutura Metálica Galpão A",
        tags: [{ id: "tag-1", code: "EST-01" }],
        location: { area: "Galpão A", local: "Coluna 12", equipment: "ESTR-A" },
        description: "Aplicação de Primer Epóxi e PU",
        status: "em_andamento",
        priority: "alta",
        progressPercentage: 45,
        schedule: { plannedStartDate: "2026-09-17", plannedEndDate: "2026-09-22" },
        consumptions: [],
        history: [],
        createdAt: "2026-09-17T10:00:00Z",
        updatedAt: "2026-09-17T11:00:00Z",
      },
      {
        id: "act-fase2-2",
        orderNumber: "OS-F2-002",
        name: "Demarcação de Solo Oficina",
        tags: [{ id: "tag-2", code: "PISO-02" }],
        location: { area: "Oficina", local: "Piso Geral", equipment: "PISO" },
        description: "Pintura de faixas de pedestre",
        status: "planejada",
        priority: "media",
        progressPercentage: 0,
        schedule: { plannedStartDate: "2026-09-18", plannedEndDate: "2026-09-19" },
        consumptions: [],
        history: [],
        createdAt: "2026-09-17T10:30:00Z",
        updatedAt: "2026-09-17T10:30:00Z",
      },
    ];

    await cacheActivitiesLocally(activitiesSample, testDb);
    const countAct = await testDb.activities.count();
    assert(countAct === 2, "1. Gravação das atividades recebidas online no IndexedDB");

    // 2. Buscar atividades do IndexedDB quando a rede falhar
    const localActivities = await getLocalActivities(testDb);
    assert(
      localActivities.length === 2 &&
        localActivities.some((a) => a.orderNumber === "OS-F2-001") &&
        localActivities.some((a) => a.orderNumber === "OS-F2-002"),
      "2. Recuperação de lista completa de atividades a partir do IndexedDB"
    );

    // 3. Buscar atividade individual offline
    const individualAct = await getLocalActivityById("act-fase2-1", testDb);
    assert(
      individualAct !== null && individualAct.id === "act-fase2-1" && individualAct.progressPercentage === 45,
      "3. Recuperação de atividade individual offline pelo ID com integridade"
    );

    // 4. Buscar materiais online e persistir
    const materialsSample: Material[] = [
      {
        id: "mat-fase2-1",
        code: "EPOXI-VERDE-01",
        name: "Fundo Epóxi Poliamida Verde",
        type: "Fundo Epóxi",
        unit: "L",
        currentStock: 250,
        minimumStock: 50,
        consumptionPerM2PerCoat: 0.18,
        consumptionUnit: "L/m²/demão",
        packageType: "Galão",
        packageVolume: 3.6,
        active: true,
        status: "adequado",
      },
    ];

    await cacheMaterialsLocally(materialsSample, testDb);
    assert((await testDb.materials.count()) === 1, "4. Gravação de catálogo de materiais no IndexedDB");

    // 5. Buscar materiais offline
    const localMats = await getLocalMaterials(testDb);
    assert(
      localMats.length === 1 &&
        localMats[0].code === "EPOXI-VERDE-01" &&
        localMats[0].consumptionPerM2PerCoat === 0.18 &&
        localMats[0].packageVolume === 3.6,
      "5. Leitura offline de materiais preservando atributos técnicos e estoque"
    );

    // 6. Buscar notificações offline
    const notifsSample: NotificationItem[] = [
      {
        id: "notif-fase2-1",
        eventKey: "ESTOQUE_CRITICO_01",
        title: "Estoque Mínimo Atingido",
        message: "O material Solvente está abaixo do nível de segurança.",
        severity: "alerta",
        category: "estoque",
        createdAt: "2026-09-17T12:00:00Z",
        read: false,
      },
    ];

    await cacheNotificationsLocally(notifsSample, testDb);
    const localNotifs = await getLocalNotifications(testDb);
    assert(
      localNotifs.length === 1 && localNotifs[0].title === "Estoque Mínimo Atingido",
      "6. Gravação e leitura offline de notificações operacionais"
    );

    // 7. Primeira abertura sem cache
    const emptyDbName = "EmptyDB_" + Date.now();
    const emptyDb = new SistemaPinturaLocalDB(emptyDbName);
    await emptyDb.open();
    const emptyActs = await getLocalActivities(emptyDb);
    assert(emptyActs.length === 0, "7. Primeira abertura sem cache retorna lista vazia sem erros");
    emptyDb.close();

    // 8. Abertura offline com cache
    assert(localActivities.length > 0, "8. Abertura offline com cache exibe dados locais");

    // 9. Falha do Supabase enquanto navigator.onLine indica true (Simulação de erro de rede)
    const simulatedFetchError = new TypeError("Failed to fetch");
    const simulatedTimeoutError = new Error("NetworkRequestFailed timeout connection refused");
    assert(
      isNetworkOrOfflineError(simulatedFetchError) && isNetworkOrOfflineError(simulatedTimeoutError),
      "9. Detecção precisa de falhas de conectividade/rede mesmo com navigator.onLine true"
    );

    // 10. Atualização do cache após resposta online (Re-cache de atividade atualizada)
    const updatedOnlineAct: Activity = {
      ...activitiesSample[0],
      progressPercentage: 80,
      updatedAt: "2026-09-17T15:00:00Z",
    };
    await cacheSingleActivityLocally(updatedOnlineAct, testDb);
    const refreshedLocal = await getLocalActivityById("act-fase2-1", testDb);
    assert(
      refreshedLocal?.progressPercentage === 80,
      "10. Atualização correta do registro no IndexedDB ao receber resposta online mais recente"
    );

    // 11. Preservação dos metadados locais de sincronização
    const meta = await getOrCreateSyncMetadata(testDb);
    assert(
      typeof meta.lastActivitiesSync === "string" && typeof meta.lastMaterialsSync === "string",
      "11. Preservação e atualização dos metadados de syncMetadata (carimbos por entidade)"
    );

    // 12. Persistência após F5 / reabertura do banco
    testDb.close();
    const reopenedDb = new SistemaPinturaLocalDB(dbName);
    await reopenedDb.open();
    const reopenedActivities = await getLocalActivities(reopenedDb);
    const reopenedMaterials = await getLocalMaterials(reopenedDb);
    assert(
      reopenedActivities.length === 2 &&
        reopenedActivities.find((a) => a.id === "act-fase2-1")?.progressPercentage === 80 &&
        reopenedMaterials.length === 1 &&
        reopenedMaterials[0].code === "EPOXI-VERDE-01",
      "12. Persistência física íntegra de todos os dados após fechamento e reabertura do banco"
    );
    reopenedDb.close();
  } catch (err) {
    console.error("Erro no teste da Fase 2:", err);
    failed++;
  }

  console.log("==================================================");
  console.log(`RESULTADO DA FASE 2: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests();
