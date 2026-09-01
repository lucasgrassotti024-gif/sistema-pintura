import { Material, MaterialLinkedActivity, MaterialPlanningMetrics, MaterialStockStatus } from "../types/material.types";

/**
 * Determina a situação física com base no saldo e estoque mínimo
 */
export function calculateStockStatus(currentStock: number, minimumStock: number): MaterialStockStatus {
  if (currentStock <= 0 || currentStock < minimumStock) {
    return "critico";
  }
  if (currentStock <= minimumStock * 1.15) {
    return "atencao";
  }
  return "adequado";
}

/**
 * Determina a situação projetada considerando o Saldo Projetado vs Estoque Mínimo
 * 
 * Regra:
 * - Crítico (Insuficiente): Saldo Projetado <= 0 ou Saldo Projetado < Estoque Mínimo
 * - Atenção (Risco): Saldo Projetado <= Estoque Mínimo * 1.15
 * - Adequado: Saldo Projetado > Estoque Mínimo * 1.15
 */
export function calculateProjectedStockStatus(projectedStock: number, minimumStock: number): MaterialStockStatus {
  if (projectedStock <= 0 || projectedStock < minimumStock) {
    return "critico";
  }
  if (projectedStock <= minimumStock * 1.15) {
    return "atencao";
  }
  return "adequado";
}

/**
 * Calcula o percentual de disponibilidade após o planejamento restante
 * Ex: Se Estoque Atual = 90 L e Saldo Projetado = 70 L -> (70 / 90) * 100 = 78%
 */
export function calculateAvailablePercentage(currentStock: number, projectedStock: number): number {
  if (currentStock <= 0) return 0;
  if (projectedStock <= 0) return 0;
  const pct = Math.round((projectedStock / currentStock) * 100);
  return Math.max(0, Math.min(100, pct));
}

/**
 * Consolida as métricas de planejamento para um único material
 */
export function consolidateMaterialPlanningMetrics(
  material: Material,
  linkedActivities: MaterialLinkedActivity[]
): MaterialPlanningMetrics {
  const currentStock = Number(material.currentStock) || 0;
  const minimumStock = Number(material.minimumStock) || 0;

  let totalPlannedOriginal = 0;
  let totalConsumedReal = 0;
  let totalRemainingPlanned = 0;
  let totalDeviation = 0;

  for (const act of linkedActivities) {
    totalPlannedOriginal += act.plannedQuantity;
    totalConsumedReal += act.consumedQuantity;
    totalRemainingPlanned += act.remainingPlannedQuantity;
    totalDeviation += act.deviationQuantity;
  }

  // FÓRMULA CENTRAL: Saldo Projetado = Estoque Atual - Planejado Restante Total
  // (O estoque atual já foi baixado pelo consumo real; nunca descontar novamente o consumo real)
  const projectedStock = currentStock - totalRemainingPlanned;
  const availablePercentage = calculateAvailablePercentage(currentStock, projectedStock);
  const projectedStatus = calculateProjectedStockStatus(projectedStock, minimumStock);

  return {
    material,
    plannedOriginal: Math.round(totalPlannedOriginal * 100) / 100,
    consumedReal: Math.round(totalConsumedReal * 100) / 100,
    remainingPlanned: Math.round(totalRemainingPlanned * 100) / 100,
    projectedStock: Math.round(projectedStock * 100) / 100,
    deviation: Math.round(totalDeviation * 100) / 100,
    availablePercentageAfterPlanning: availablePercentage,
    projectedStatus,
    linkedActivities,
  };
}
