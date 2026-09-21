import { localDb, SistemaPinturaLocalDB } from "./local-db";
import { RealtimeReconcilerService, realtimeReconciler } from "./realtime-reconciler.service";
import { getOrCreateSyncMetadata, updateSyncMetadata } from "./local-db.helpers";
import { SupabaseClientLike } from "./sync-engine/dispatchers/create-activity.dispatcher";
import { createClient } from "@/lib/supabase/client";

export interface CatchUpOptions {
  batchSize?: number;
  overlapMinutes?: number; // Padrão: 5 minutos
}

export interface CatchUpStats {
  activitiesFetched: number;
  activitiesReconciled: number;
  materialsFetched: number;
  materialsReconciled: number;
  checkpoint: string;
}

/**
 * Serviço de Catch-up Offline (Fase 6E).
 *
 * Responsabilidades:
 * 1. Recuperar alterações que ocorreram no servidor durante o período offline;
 * 2. Aplicar paginação segura para não estourar limites de memória ou payload;
 * 3. Utilizar janela de overlap (5 minutos retroativos ao último checkpoint) para
 *    prevenir perda de eventos devido a transações concorrentes ou clock skew;
 * 4. Passar todos os registros recuperados pelo `RealtimeReconcilerService` para
 *    garantir que mutations locais pendentes na Outbox jamais sejam sobrescritas;
 * 5. Atualizar o checkpoint com o maior timestamp efetivamente retornado pelo PostgreSQL.
 */
export class OfflineCatchUpService {
  private db: SistemaPinturaLocalDB;
  private reconciler: RealtimeReconcilerService;

  constructor(
    db: SistemaPinturaLocalDB = localDb,
    reconciler: RealtimeReconcilerService = realtimeReconciler
  ) {
    this.db = db;
    this.reconciler = reconciler;
  }

  /**
   * Executa o processo completo de catch-up com paginação e overlap.
   */
  public async executeCatchUp(
    supabaseClient?: SupabaseClientLike,
    options: CatchUpOptions = {}
  ): Promise<CatchUpStats> {
    const client = supabaseClient || createClient();
    const batchSize = options.batchSize || 100;
    const overlapMinutes = options.overlapMinutes ?? 5;

    const metadata = await getOrCreateSyncMetadata(this.db);
    const lastSyncIso = metadata.lastActivitiesSync;

    // Calcula timestamp com janela de overlap retroativa de segurança
    let sinceTimestamp: string | null = null;
    if (lastSyncIso) {
      const date = new Date(lastSyncIso);
      date.setMinutes(date.getMinutes() - overlapMinutes);
      sinceTimestamp = date.toISOString();
    }

    const stats: CatchUpStats = {
      activitiesFetched: 0,
      activitiesReconciled: 0,
      materialsFetched: 0,
      materialsReconciled: 0,
      checkpoint: sinceTimestamp || new Date().toISOString(),
    };

    let latestServerTimestamp = lastSyncIso || new Date(0).toISOString();

    // 1. CATCH-UP DE ATIVIDADES COM PAGINAÇÃO
    let hasMoreActivities = true;
    let activityOffset = 0;

    while (hasMoreActivities) {
      let query = client
        .from("activities")
        .select(`
          id,
          order_number,
          name,
          service_type,
          description,
          origin_reference,
          status,
          priority,
          progress_percentage,
          planned_start_date,
          planned_end_date,
          actual_start_date,
          actual_end_date,
          created_at,
          updated_at,
          version,
          archived_at
        `)
        .order("updated_at", { ascending: true })
        .range(activityOffset, activityOffset + batchSize - 1);

      if (sinceTimestamp) {
        query = query.gte("updated_at", sinceTimestamp);
      }

      const { data: rows, error } = await query;
      if (error) {
        console.warn("[OfflineCatchUp] Erro ao buscar atividades no catch-up:", error);
        break;
      }

      const fetchedList = rows || [];
      stats.activitiesFetched += fetchedList.length;

      for (const row of fetchedList) {
        const rowUpdatedAt = row.updated_at || row.created_at;
        if (rowUpdatedAt > latestServerTimestamp) {
          latestServerTimestamp = rowUpdatedAt;
        }

        const activityMapped: any = {
          id: row.id,
          orderNumber: row.order_number,
          name: row.name,
          serviceType: row.service_type,
          description: row.description,
          originReference: row.origin_reference,
          status: row.status,
          priority: row.priority,
          progressPercentage: row.progress_percentage,
          schedule: {
            plannedStartDate: row.planned_start_date,
            plannedEndDate: row.planned_end_date,
            actualStartDate: row.actual_start_date,
            actualEndDate: row.actual_end_date,
          },
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          version: row.version ?? 1,
          archivedAt: row.archived_at,
        };

        const result = await this.reconciler.reconcileActivityUpsert(activityMapped, "UPDATE");
        if (result.applied) {
          stats.activitiesReconciled++;
        }
      }

      if (fetchedList.length < batchSize) {
        hasMoreActivities = false;
      } else {
        activityOffset += batchSize;
      }
    }

    // 2. CATCH-UP DE MATERIAIS COM PAGINAÇÃO
    let hasMoreMaterials = true;
    let materialOffset = 0;

    while (hasMoreMaterials) {
      let query = client
        .from("materials")
        .select(`
          id,
          code,
          name,
          type,
          unit,
          current_stock,
          minimum_stock,
          active,
          created_at,
          updated_at
        `)
        .order("updated_at", { ascending: true })
        .range(materialOffset, materialOffset + batchSize - 1);

      if (sinceTimestamp) {
        query = query.gte("updated_at", sinceTimestamp);
      }

      const { data: rows, error } = await query;
      if (error) {
        console.warn("[OfflineCatchUp] Erro ao buscar materiais no catch-up:", error);
        break;
      }

      const fetchedList = rows || [];
      stats.materialsFetched += fetchedList.length;

      for (const row of fetchedList) {
        const materialMapped: any = {
          id: row.id,
          code: row.code,
          name: row.name,
          type: row.type,
          unit: row.unit,
          currentStock: Number(row.current_stock) || 0,
          minimumStock: Number(row.minimum_stock) || 0,
          active: row.active ?? true,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };

        const result = await this.reconciler.reconcileMaterialUpsert(materialMapped, "UPDATE");
        if (result.applied) {
          stats.materialsReconciled++;
        }
      }

      if (fetchedList.length < batchSize) {
        hasMoreMaterials = false;
      } else {
        materialOffset += batchSize;
      }
    }

    // 3. ATUALIZA CHECKPOINT SEGURO COM O MAIOR CARIMBO DO SERVIDOR PROCESSADO
    await updateSyncMetadata(
      {
        lastActivitiesSync: latestServerTimestamp,
        lastMaterialsSync: latestServerTimestamp,
      },
      this.db
    );

    stats.checkpoint = latestServerTimestamp;
    return stats;
  }
}

export const offlineCatchUpService = new OfflineCatchUpService();
