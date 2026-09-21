import {
  Material,
  MaterialPlanningMetrics,
  NewMaterialInput,
  PlanningPeriodFilter,
  StockEntryInput,
  StockMovement,
} from "../types/material.types";
import {
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  registerStockEntry,
  getMaterialStockMovements,
} from "../services/material.service";
import { getMaterialsPlanningMetrics } from "../services/material-planning.service";

/**
 * Contrato de repositório para o domínio de Materiais e Estoque.
 * Desacopla a interface das chamadas diretas ao Supabase/PostgREST/RPCs.
 */
export interface IMaterialRepository {
  getMaterials(): Promise<Material[]>;
  createMaterial(input: NewMaterialInput): Promise<Material>;
  updateMaterial(
    id: string,
    input: NewMaterialInput & { active?: boolean }
  ): Promise<Material>;
  deleteMaterial(id: string): Promise<Material>;
  registerStockEntry(input: StockEntryInput): Promise<{
    movementId: string;
    materialId: string;
    previousStock: number;
    newStock: number;
    quantityAdded: number;
  }>;
  getMaterialStockMovements(materialId: string): Promise<StockMovement[]>;
  getMaterialsPlanningMetrics(
    materials: Material[],
    period: PlanningPeriodFilter
  ): Promise<MaterialPlanningMetrics[]>;
}

import {
  cacheMaterialsLocally,
  getLocalMaterials,
  isNetworkOrOfflineError,
  isBrowserOnline,
} from "@/lib/offline";

/**
 * Implementação do IMaterialRepository com suporte a Cache Local e Leitura Offline (IndexedDB/Dexie).
 * ONLINE: busca no Supabase e atualiza o IndexedDB com todos os atributos técnicos e saldos.
 * OFFLINE / ERRO DE REDE: realiza fallback para os materiais armazenados no IndexedDB.
 */
export class SupabaseMaterialRepository implements IMaterialRepository {
  async getMaterials(): Promise<Material[]> {
    if (!isBrowserOnline()) {
      const local = await getLocalMaterials();
      if (local.length > 0) return local;
    }

    try {
      const mats = await getMaterials();
      cacheMaterialsLocally(mats).catch((err) =>
        console.warn("[materialRepository] Aviso ao gravar cache local de materiais:", err)
      );
      return mats;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[materialRepository] Rede indisponível. Recorrendo ao cache local de materiais.");
        const local = await getLocalMaterials();
        if (local.length > 0) {
          return local;
        }
      }
      throw err;
    }
  }

  async createMaterial(input: NewMaterialInput): Promise<Material> {
    return createMaterial(input);
  }

  async updateMaterial(
    id: string,
    input: NewMaterialInput & { active?: boolean }
  ): Promise<Material> {
    return updateMaterial(id, input);
  }

  async deleteMaterial(id: string): Promise<Material> {
    return deleteMaterial(id);
  }

  async registerStockEntry(input: StockEntryInput): Promise<{
    movementId: string;
    materialId: string;
    previousStock: number;
    newStock: number;
    quantityAdded: number;
  }> {
    return registerStockEntry(input);
  }

  async getMaterialStockMovements(materialId: string): Promise<StockMovement[]> {
    return getMaterialStockMovements(materialId);
  }

  async getMaterialsPlanningMetrics(
    materials: Material[],
    period: PlanningPeriodFilter
  ): Promise<MaterialPlanningMetrics[]> {
    return getMaterialsPlanningMetrics(materials, period);
  }
}

/**
 * Instância padrão do repositório de materiais para consumo nos hooks e componentes.
 */
export const materialRepository: IMaterialRepository = new SupabaseMaterialRepository();
