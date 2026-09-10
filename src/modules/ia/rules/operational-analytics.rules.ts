/**
 * Regras Operacionais e Cálculos Determinísticos da IA Operacional RSS3.
 * 
 * Funções puras, matemáticas e testáveis:
 * - Sem chamadas ao Supabase
 * - Sem chamadas ao Google Gemini
 * - Zero dependências externas
 * - Garantia de precisão aritmética em estoque, demandas, déficits e coberturas.
 */

export interface MaterialDemandItem {
  orderNumber: string;
  activityName: string;
  plannedQuantity: number;
}

export interface SharedStockAnalysis {
  materialId?: string;
  materialName: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  totalDemand: number;
  projectedBalance: number;
  deficit: number;
  isViable: boolean;
  isStockBelowMinimum: boolean;
  competingActivitiesCount: number;
  activities: MaterialDemandItem[];
}

export interface ActivityRiskAnalysis {
  orderNumber: string;
  activityName: string;
  status: string;
  progressPercentage: number;
  isDelayed: boolean;
  plannedEndDate: string;
  hasCriticalMaterialDeficit: boolean;
  deficitMaterials: Array<{ materialName: string; deficit: number; unit: string }>;
  riskClassification: "baixo" | "atencao" | "critico";
  riskReasons: string[];
}

/**
 * 1. Calcula o déficit projetado entre estoque físico e demanda total concorrente.
 * Formula: deficit = max(0, demanda - estoque)
 */
export function calculateMaterialDeficit(currentStock: number, totalDemand: number): {
  projectedBalance: number;
  deficit: number;
  isViable: boolean;
} {
  const stock = Math.max(0, Number(currentStock || 0));
  const demand = Math.max(0, Number(totalDemand || 0));
  const projectedBalance = Math.round((stock - demand) * 100) / 100;
  const isViable = projectedBalance >= 0;
  const deficit = isViable ? 0 : Math.round(Math.abs(projectedBalance) * 100) / 100;

  return {
    projectedBalance,
    deficit,
    isViable,
  };
}

/**
 * 2. Calcula o saldo restante de consumo de uma OS específica para um material.
 * Formula: saldoRestante = max(0, planejado - consumido)
 */
export function calculatePlannedVsConsumed(plannedQuantity: number, consumedQuantity: number): {
  planned: number;
  consumed: number;
  remaining: number;
  percentConsumed: number;
  isFullyConsumed: boolean;
  isOverconsumed: boolean;
  overconsumedAmount: number;
} {
  const planned = Math.max(0, Number(plannedQuantity || 0));
  const consumed = Math.max(0, Number(consumedQuantity || 0));
  const difference = planned - consumed;
  const remaining = difference > 0 ? Math.round(difference * 100) / 100 : 0;
  const isOverconsumed = difference < 0;
  const overconsumedAmount = isOverconsumed ? Math.round(Math.abs(difference) * 100) / 100 : 0;
  const isFullyConsumed = consumed >= planned && planned > 0;
  const percentConsumed = planned > 0 ? Math.round((consumed / planned) * 100) : 0;

  return {
    planned,
    consumed,
    remaining,
    percentConsumed,
    isFullyConsumed,
    isOverconsumed,
    overconsumedAmount,
  };
}

/**
 * 3. Análise de Estoque Compartilhado Concorrente (Horizonte Definido).
 * Considera que múltiplas OS disputam o MESMO estoque físico atual.
 * Exemplo: Estoque = 100L. OS A pede 70L, OS B pede 60L -> Demanda Agregada = 130L -> Déficit = 30L.
 */
export function analyzeSharedStockDemand(
  materialName: string,
  unit: string,
  currentStock: number,
  minimumStock: number,
  demands: MaterialDemandItem[],
  materialId?: string
): SharedStockAnalysis {
  const stock = Math.max(0, Number(currentStock || 0));
  const minStock = Math.max(0, Number(minimumStock || 0));

  // Soma determinística de todas as demandas concorrentes no horizonte
  const totalDemand = demands.reduce((sum, d) => sum + Math.max(0, Number(d.plannedQuantity || 0)), 0);
  const roundedDemand = Math.round(totalDemand * 100) / 100;

  const { projectedBalance, deficit, isViable } = calculateMaterialDeficit(stock, roundedDemand);
  const isStockBelowMinimum = stock < minStock;

  return {
    materialId,
    materialName,
    unit,
    currentStock: stock,
    minimumStock: minStock,
    totalDemand: roundedDemand,
    projectedBalance,
    deficit,
    isViable,
    isStockBelowMinimum,
    competingActivitiesCount: demands.length,
    activities: demands,
  };
}

/**
 * 4. Classificação Objetiva de Risco Operacional por Atividade.
 * Baseada estritamente em fatos do sistema (atraso de prazo, progresso e déficit comprovado de insumos).
 */
export function classifyActivityOperationalRisk(params: {
  orderNumber: string;
  activityName: string;
  status: string;
  progressPercentage: number;
  plannedEndDate: string;
  todayISO: string;
  deficitMaterials?: Array<{ materialName: string; deficit: number; unit: string }>;
}): ActivityRiskAnalysis {
  const {
    orderNumber,
    activityName,
    status,
    progressPercentage,
    plannedEndDate,
    todayISO,
    deficitMaterials = [],
  } = params;

  const isCompleted = status === "concluida" || status === "cancelada";
  const isDelayed = !isCompleted && plannedEndDate < todayISO;
  const hasCriticalMaterialDeficit = deficitMaterials.length > 0;
  const riskReasons: string[] = [];

  let riskClassification: "baixo" | "atencao" | "critico" = "baixo";

  if (!isCompleted) {
    if (isDelayed) {
      riskReasons.push(`Prazo planejado venceu em ${plannedEndDate}`);
    }

    if (hasCriticalMaterialDeficit) {
      const defStr = deficitMaterials
        .map((m) => `${m.materialName} (déficit de ${m.deficit} ${m.unit})`)
        .join(", ");
      riskReasons.push(`Falta projetada de material no período: ${defStr}`);
    }

    if (isDelayed && hasCriticalMaterialDeficit) {
      riskClassification = "critico";
    } else if (isDelayed || hasCriticalMaterialDeficit || (progressPercentage < 50 && plannedEndDate <= todayISO)) {
      riskClassification = "critico";
    } else if (progressPercentage < 20 || status === "pausada") {
      riskClassification = "atencao";
      if (status === "pausada") riskReasons.push("Atividade atualmente pausada na operação");
    }
  }

  return {
    orderNumber,
    activityName,
    status,
    progressPercentage,
    isDelayed,
    plannedEndDate,
    hasCriticalMaterialDeficit,
    deficitMaterials,
    riskClassification,
    riskReasons,
  };
}
