import { localDb, SistemaPinturaLocalDB } from "./local-db";
import {
  LocalActivityRecord,
  LocalOutboxQueueRecord,
} from "./local-db.types";
import { getOrCreateClientId } from "./local-db.helpers";
import { Activity } from "@/modules/atividades/types/activity.types";
import { outboxNotifier } from "./outbox-notifier";

/**
 * Cria uma atividade localmente em modo offline e enfileira uma mutação CREATE_ACTIVITY na Outbox.
 * Operação executada atomicamente em transação Dexie única.
 *
 * @param activityData Objeto de atividade preenchido pelo formulário.
 * @param currentUserId Identificador opcional do usuário autenticado no momento.
 * @returns Atividade persistida localmente com UUID estável e syncStatus="pending".
 */
export async function createOfflineActivity(
  activityData: Activity,
  currentUserId?: string,
  db: SistemaPinturaLocalDB = localDb
): Promise<Activity> {
  const clientId = getOrCreateClientId();
  const mutationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const now = new Date().toISOString();

  // Gera UUID local real e estável se a atividade não tiver um UUID válido
  // Não usa Date.now() nem act-Date.now()
  const activityId =
    activityData.id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityData.id)
      ? activityData.id
      : crypto.randomUUID();

  const localActivity: LocalActivityRecord = {
    ...activityData,
    id: activityId,
    syncStatus: "pending",
    localUpdatedAt: now,
    localVersion: 1,
    createdAt: activityData.createdAt || now,
    updatedAt: now,
  };

  // Payload completo e desacoplado para futuro processamento pelo Sync Engine
  const payload: Record<string, unknown> = {
    activityId,
    orderNumber: localActivity.orderNumber,
    name: localActivity.name,
    serviceType: localActivity.serviceType,
    tags: localActivity.tags,
    location: localActivity.location,
    description: localActivity.description,
    status: localActivity.status,
    priority: localActivity.priority,
    assignedUserId: localActivity.assignedUserId,
    assignedTo: localActivity.assignedTo,
    team: localActivity.team,
    serviceQuantity: localActivity.serviceQuantity,
    serviceUnit: localActivity.serviceUnit,
    plannedMaterials: localActivity.plannedMaterials,
    originReference: localActivity.originReference,
    observations: localActivity.observations,
    schedule: localActivity.schedule,
    progressPercentage: localActivity.progressPercentage,
    userId: currentUserId || localActivity.assignedUserId,
    createdAt: localActivity.createdAt,
  };

  const outboxEntry: LocalOutboxQueueRecord = {
    mutationId,
    idempotencyKey,
    clientId,
    entityType: "activity",
    entityId: activityId,
    operation: "CREATE_ACTIVITY",
    baseVersion: 1,
    clientTimestamp: now,
    payload,
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: now,
  };

  // Transação Atômica Dexie: Atividade + Outbox
  await db.transaction("rw", [db.activities, db.outboxQueue], async () => {
    await db.activities.put(localActivity);
    await db.outboxQueue.put(outboxEntry);
  });

  outboxNotifier.notify({
    type: "enqueued",
    entityType: "activity",
    entityId: activityId,
    mutationId,
    timestamp: now,
  });

  return localActivity;
}

/**
 * Atualiza uma atividade localmente em modo offline e enfileira uma mutação UPDATE_ACTIVITY na Outbox.
 * Operação executada atomicamente em transação Dexie única.
 *
 * @param activityData Objeto de atividade com as alterações.
 * @param currentUserId Identificador opcional do usuário.
 * @returns Atividade atualizada localmente com syncStatus="pending".
 */
export async function updateOfflineActivity(
  activityData: Activity,
  currentUserId?: string,
  db: SistemaPinturaLocalDB = localDb
): Promise<Activity> {
  if (!activityData.id) {
    throw new Error("ID da atividade é obrigatório para atualização offline.");
  }

  const clientId = getOrCreateClientId();
  const mutationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const now = new Date().toISOString();

  // Consulta registro anterior para versionamento e preservação de metadados
  const existing = await db.activities.get(activityData.id);
  const nextVersion = (existing?.localVersion || 1) + 1;

  const localActivity: LocalActivityRecord = {
    ...activityData,
    syncStatus: "pending",
    localUpdatedAt: now,
    baseServerUpdatedAt: existing?.baseServerUpdatedAt || existing?.updatedAt,
    localVersion: nextVersion,
    updatedAt: now,
  };

  const payload: Record<string, unknown> = {
    activityId: localActivity.id,
    orderNumber: localActivity.orderNumber,
    name: localActivity.name,
    serviceType: localActivity.serviceType,
    tags: localActivity.tags,
    location: localActivity.location,
    description: localActivity.description,
    status: localActivity.status,
    priority: localActivity.priority,
    assignedUserId: localActivity.assignedUserId,
    assignedTo: localActivity.assignedTo,
    team: localActivity.team,
    serviceQuantity: localActivity.serviceQuantity,
    serviceUnit: localActivity.serviceUnit,
    plannedMaterials: localActivity.plannedMaterials,
    originReference: localActivity.originReference,
    observations: localActivity.observations,
    schedule: localActivity.schedule,
    userId: currentUserId || localActivity.assignedUserId,
    updatedAt: localActivity.updatedAt,
  };

  const outboxEntry: LocalOutboxQueueRecord = {
    mutationId,
    idempotencyKey,
    clientId,
    entityType: "activity",
    entityId: localActivity.id,
    operation: "UPDATE_ACTIVITY",
    baseVersion: nextVersion,
    clientTimestamp: now,
    payload,
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: now,
  };

  // Transação Atômica Dexie: Atividade + Outbox
  await db.transaction("rw", [db.activities, db.outboxQueue], async () => {
    await db.activities.put(localActivity);
    await db.outboxQueue.put(outboxEntry);
  });

  outboxNotifier.notify({
    type: "enqueued",
    entityType: "activity",
    entityId: localActivity.id,
    mutationId,
    timestamp: now,
  });

  return localActivity;
}

/**
 * Cancela uma atividade localmente em modo offline e enfileira uma mutação CANCEL_ACTIVITY na Outbox.
 * Operação executada atomicamente em transação Dexie única.
 *
 * @param activityId ID da atividade a ser cancelada.
 * @param justification Motivo/justificativa obrigatória do cancelamento.
 * @param currentUserId Identificador opcional do usuário solicitante.
 * @returns Atividade com status="cancelada" e syncStatus="pending".
 */
export async function cancelOfflineActivity(
  activityId: string,
  justification: string,
  currentUserId?: string,
  db: SistemaPinturaLocalDB = localDb
): Promise<Activity> {
  if (!activityId) {
    throw new Error("ID da atividade é obrigatório para cancelamento.");
  }
  if (!justification.trim()) {
    throw new Error("A justificativa de cancelamento é obrigatória.");
  }

  const existing = await db.activities.get(activityId);
  if (!existing) {
    throw new Error("Atividade não encontrada no banco local para cancelamento.");
  }

  const clientId = getOrCreateClientId();
  const mutationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const now = new Date().toISOString();
  const nextVersion = (existing.localVersion || 1) + 1;

  const cancellationHistoryEntry = {
    id: `hist-${crypto.randomUUID()}`,
    timestamp: now,
    userId: currentUserId || "user-offline",
    userName: existing.assignedTo || "Operador",
    action: "Atividade cancelada (offline)",
    observation: justification.trim(),
  };

  const cancelledActivity: LocalActivityRecord = {
    ...existing,
    status: "cancelada",
    syncStatus: "pending",
    localUpdatedAt: now,
    localVersion: nextVersion,
    updatedAt: now,
    history: [cancellationHistoryEntry, ...(existing.history || [])],
  };

  const payload: Record<string, unknown> = {
    activityId,
    cancellationReason: justification.trim(),
    userId: currentUserId,
    cancelledAt: now,
  };

  const outboxEntry: LocalOutboxQueueRecord = {
    mutationId,
    idempotencyKey,
    clientId,
    entityType: "activity",
    entityId: activityId,
    operation: "CANCEL_ACTIVITY",
    baseVersion: nextVersion,
    clientTimestamp: now,
    payload,
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: now,
  };

  // Transação Atômica Dexie: Atividade + Outbox
  await db.transaction("rw", [db.activities, db.outboxQueue], async () => {
    await db.activities.put(cancelledActivity);
    await db.outboxQueue.put(outboxEntry);
  });

  outboxNotifier.notify({
    type: "enqueued",
    entityType: "activity",
    entityId: activityId,
    mutationId,
    timestamp: now,
  });

  return cancelledActivity;
}

/**
 * Registra o avanço de progresso e apontamento de consumo real offline na OutboxQueue.
 * Operação executada atomicamente em transação Dexie única.
 * 
 * Regras:
 * - Preserva newProgress e consumptions exatamente como registrados;
 * - Gera idempotencyKey estável no momento da ação (reutilizada em todos os retries);
 * - Atualiza o registro local da atividade com syncStatus = "pending";
 * - NÃO recalcula valores nem simula estoque confirmado prematuramente.
 *
 * @param activityId UUID da atividade.
 * @param newProgress Novo percentual de progresso (0 a 100).
 * @param consumptionsList Consumos reais informados pelo usuário.
 * @param observation Observação opcional da evolução.
 * @param currentUserId Identificador opcional do usuário.
 * @param db Instância Dexie.
 * @returns Atividade atualizada localmente com syncStatus="pending".
 */
export async function updateOfflineActivityProgress(
  activityId: string,
  newProgress: number,
  consumptionsList: Array<{ materialName: string; quantity: number; unit: string }> = [],
  observation?: string,
  currentUserId?: string,
  db: SistemaPinturaLocalDB = localDb
): Promise<Activity> {
  if (!activityId) {
    throw new Error("ID da atividade é obrigatório para atualização de progresso.");
  }

  if (newProgress < 0 || newProgress > 100) {
    throw new Error("Progresso inválido: deve estar entre 0% e 100%.");
  }

  const existing = await db.activities.get(activityId);
  if (!existing) {
    throw new Error("Atividade não encontrada no banco local para atualização de progresso.");
  }

  if (existing.status === "cancelada") {
    throw new Error("Não é permitido atualizar o progresso de uma atividade cancelada.");
  }

  if (newProgress < existing.progressPercentage) {
    throw new Error(
      `O novo progresso (${newProgress}%) não pode ser inferior ao progresso anterior (${existing.progressPercentage}%).`
    );
  }

  const clientId = getOrCreateClientId();
  const mutationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const now = new Date().toISOString();
  const nextVersion = (existing.localVersion || 1) + 1;

  // Determinar status operacional calculado conforme regra do servidor
  let calculatedStatus: Activity["status"] = existing.status;
  if (newProgress === 0) {
    calculatedStatus = "programada";
  } else if (newProgress >= 100) {
    calculatedStatus = "concluida";
  } else {
    calculatedStatus = "em_andamento";
  }

  // Mapear novos consumos locais
  const newConsumptions = consumptionsList.map((c) => ({
    id: `cons-${crypto.randomUUID()}`,
    materialName: c.materialName,
    quantity: c.quantity,
    unit: c.unit,
    registeredAt: now,
    registeredBy: existing.assignedTo || "Operador",
  }));

  const historyEntry = {
    id: `hist-${crypto.randomUUID()}`,
    timestamp: now,
    userId: currentUserId || "user-offline",
    userName: existing.assignedTo || "Operador",
    action: `Avanço de Progresso: ${existing.progressPercentage}% → ${newProgress}% (${calculatedStatus.toUpperCase()})`,
    field: "Progresso",
    oldValue: `${existing.progressPercentage}%`,
    newValue: `${newProgress}%`,
    oldProgress: existing.progressPercentage,
    newProgress,
    consumedMaterials: consumptionsList,
    observation: observation?.trim() || undefined,
  };

  const updatedActivity: LocalActivityRecord = {
    ...existing,
    progressPercentage: newProgress,
    status: calculatedStatus,
    syncStatus: "pending",
    localUpdatedAt: now,
    localVersion: nextVersion,
    updatedAt: now,
    consumptions: [...(existing.consumptions || []), ...newConsumptions],
    history: [historyEntry, ...(existing.history || [])],
  };

  // Payload completo e imutável para a Outbox
  const payload: Record<string, unknown> = {
    activityId,
    newProgress,
    consumptions: consumptionsList.map((c) => ({
      custom_material_name: c.materialName,
      quantity: c.quantity,
      unit: c.unit,
    })),
    observation: observation?.trim() || null,
    clientTimestamp: now,
    userId: currentUserId,
  };

  const outboxEntry: LocalOutboxQueueRecord = {
    mutationId,
    idempotencyKey,
    clientId,
    entityType: "activity",
    entityId: activityId,
    operation: "PROGRESS_UPDATE",
    baseVersion: nextVersion,
    clientTimestamp: now,
    payload,
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    createdAt: now,
  };

  // Transação Atômica Dexie: Atividade + Outbox
  await db.transaction("rw", [db.activities, db.outboxQueue], async () => {
    await db.activities.put(updatedActivity);
    await db.outboxQueue.put(outboxEntry);
  });

  outboxNotifier.notify({
    type: "enqueued",
    entityType: "activity",
    entityId: activityId,
    mutationId,
    timestamp: now,
  });

  return updatedActivity;
}
