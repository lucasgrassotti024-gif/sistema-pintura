import { SistemaPinturaLocalDB, localDb } from "../local-db";
import { LocalOutboxQueueRecord, OutboxMutationStatus } from "../local-db.types";

/**
 * Camada de gerenciamento e leitura da fila de mutações da Outbox.
 *
 * Responsabilidades:
 * - Leitura rigorosamente FIFO por entidade (respeitando createdAt e baseVersion);
 * - Nunca processar uma mutação posterior de uma entidade antes da anterior;
 * - Respeitar status do ciclo de vida: pending, syncing, synced, failed, conflict;
 * - Respeitar agendamento de retry (nextRetryAt).
 */
export class SyncQueueManager {
  private db: SistemaPinturaLocalDB;

  constructor(db: SistemaPinturaLocalDB = localDb) {
    this.db = db;
  }

  /**
   * Obtém a lista de mutações elegíveis para processamento ordenadas por FIFO.
   *
   * Regras de elegibilidade:
   * 1. Status 'pending';
   * 2. Se possuir 'nextRetryAt', deve ser <= agora;
   * 3. Ordenação rigorosa por createdAt ascendente.
   *
   * Garantia FIFO por entidade:
   * Se uma entidade tiver mutações anteriores em processamento ou com falha,
   * as mutações posteriores não devem ultrapassá-la.
   */
  async getEligibleMutations(now: Date = new Date()): Promise<LocalOutboxQueueRecord[]> {
    const allRecords = await this.db.outboxQueue.toArray();

    // Filtra mutações com status 'pending' que já estão prontas para processamento
    const nowIso = now.toISOString();

    const pending = allRecords.filter((m) => {
      if (m.status !== "pending") return false;
      if (m.nextRetryAt && m.nextRetryAt > nowIso) return false;
      return true;
    });

    // Ordenação FIFO global por createdAt
    pending.sort((a, b) => {
      const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (a.baseVersion || 0) - (b.baseVersion || 0);
    });

    // Garante que não processamos mutações posteriores de uma entidade
    // se já houver uma mutação em estado 'syncing', 'failed' ou 'conflict' para essa entidade
    const getEntityKey = (rec: LocalOutboxQueueRecord) => {
      // Mutações do tipo "photo" pertencem ao escopo da atividade identificada por entityId
      if (rec.entityType === "photo") {
        return `activity:${rec.entityId}`;
      }
      return `${rec.entityType}:${rec.entityId}`;
    };

    const blockedEntityIds = new Set<string>();
    for (const rec of allRecords) {
      if (rec.status === "syncing" || rec.status === "failed" || rec.status === "conflict") {
        blockedEntityIds.add(getEntityKey(rec));
      }
    }

    const eligible: LocalOutboxQueueRecord[] = [];
    const seenInBatch = new Set<string>();

    for (const mut of pending) {
      const entityKey = getEntityKey(mut);

      // Se a entidade tem pendências bloqueadas ou já tem uma mutação anterior neste batch,
      // não ultrapassa a mutação anterior (processamento sequencial estrito por entidade).
      if (blockedEntityIds.has(entityKey)) {
        continue;
      }

      // No batch atual, adiciona a mutação mais antiga da entidade e bloqueia posteriores
      if (!seenInBatch.has(entityKey)) {
        eligible.push(mut);
        seenInBatch.add(entityKey);
      }
    }

    return eligible;
  }

  /**
   * Atualiza o status e metadados de uma mutação na fila de forma atômica.
   */
  async updateMutationStatus(
    mutationId: string,
    updates: {
      status: OutboxMutationStatus;
      lastAttemptAt?: string;
      nextRetryAt?: string;
      retryCount?: number;
      errorCode?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    await this.db.outboxQueue.update(mutationId, updates);
  }

  /**
   * Obtém as contagens para o evento de progresso.
   */
  async getQueueStats(): Promise<{ total: number; pending: number; failed: number; conflict: number }> {
    const all = await this.db.outboxQueue.toArray();
    let pending = 0;
    let failed = 0;
    let conflict = 0;

    for (const item of all) {
      if (item.status === "pending" || item.status === "syncing") {
        pending++;
      } else if (item.status === "failed") {
        failed++;
      } else if (item.status === "conflict") {
        conflict++;
      }
    }

    return {
      total: all.length,
      pending,
      failed,
      conflict,
    };
  }

  /**
   * Consulta uma mutação específica por ID
   */
  async getMutationById(mutationId: string): Promise<LocalOutboxQueueRecord | undefined> {
    return this.db.outboxQueue.get(mutationId);
  }
}

export const syncQueueManager = new SyncQueueManager();
