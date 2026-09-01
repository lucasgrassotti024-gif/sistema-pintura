import { createClient } from "@/lib/supabase/client";
import { Material, MaterialLinkedActivity, MaterialPlanningMetrics, PlanningPeriodFilter } from "../types/material.types";
import { consolidateMaterialPlanningMetrics } from "../rules/material-planning.rules";
import { formatDateISO, getWeekInfo } from "@/modules/atividades/utils/week.utils";

interface SupabaseActivityDemandRow {
  id: string;
  order_number: string;
  name: string;
  service_type: string;
  status: string;
  progress_percentage: number;
  planned_start_date: string;
  planned_end_date: string;
  activity_planned_materials: Array<{
    id: string;
    material_id: string | null;
    custom_material_name: string;
    planned_quantity: number;
    unit: string;
  }> | null;
  activity_consumptions: Array<{
    id: string;
    material_id: string | null;
    custom_material_name: string | null;
    quantity: number;
    unit: string;
  }> | null;
}

/**
 * Carrega atividades com seus materiais planejados e consumos reais para consolidar o planejamento
 */
export async function getMaterialsPlanningMetrics(
  materials: Material[],
  period: PlanningPeriodFilter = "semana"
): Promise<MaterialPlanningMetrics[]> {
  const supabase = createClient();

  // 1. Carregar atividades não arquivadas com planned_materials e consumptions
  const { data, error } = await supabase
    .from("activities")
    .select(`
      id,
      order_number,
      name,
      service_type,
      status,
      progress_percentage,
      planned_start_date,
      planned_end_date,
      activity_planned_materials (
        id,
        material_id,
        custom_material_name,
        planned_quantity,
        unit
      ),
      activity_consumptions (
        id,
        material_id,
        custom_material_name,
        quantity,
        unit
      )
    `)
    .is("archived_at", null)
    .order("planned_start_date", { ascending: true });

  if (error) {
    console.error("[getMaterialsPlanningMetrics] Erro ao carregar atividades do Supabase:", error);
    throw new Error(`Falha ao carregar dados de planejamento: ${error.message}`);
  }

  const allActivities = (data || []) as unknown as SupabaseActivityDemandRow[];

  // 2. Filtrar atividades elegíveis pelo período
  const todayISO = formatDateISO(new Date());
  const currentWeek = getWeekInfo(new Date(), true);
  const currentMonthPrefix = todayISO.substring(0, 7); // "YYYY-MM"

  const eligibleActivities = allActivities.filter((act) => {
    if (period === "todas") return true;

    if (period === "semana") {
      // Interseção entre o intervalo planejado da OS e a semana atual
      return (
        act.planned_start_date <= currentWeek.endDate &&
        act.planned_end_date >= currentWeek.startDate
      );
    }

    if (period === "mes") {
      const startMonth = act.planned_start_date.substring(0, 7);
      const endMonth = act.planned_end_date.substring(0, 7);
      return startMonth <= currentMonthPrefix && endMonth >= currentMonthPrefix;
    }

    return true;
  });

  // 3. Mapear demandas e consumos para cada material do catálogo
  const result: MaterialPlanningMetrics[] = materials.map((material) => {
    const matId = material.id;
    const matNameLower = material.name.trim().toLowerCase();
    const linkedActivities: MaterialLinkedActivity[] = [];

    for (const act of eligibleActivities) {
      // Verificar se a atividade possui demanda planejada para este material
      const matchingPlannedList = (act.activity_planned_materials || []).filter(
        (pm) =>
          (pm.material_id && pm.material_id === matId) ||
          (pm.custom_material_name && pm.custom_material_name.trim().toLowerCase() === matNameLower)
      );

      // Verificar se a atividade possui consumo apontado para este material
      const matchingConsumptions = (act.activity_consumptions || []).filter(
        (c) =>
          (c.material_id && c.material_id === matId) ||
          (c.custom_material_name && c.custom_material_name.trim().toLowerCase() === matNameLower)
      );

      const totalPlannedInActivity = matchingPlannedList.reduce(
        (acc, pm) => acc + (Number(pm.planned_quantity) || 0),
        0
      );

      const totalConsumedInActivity = matchingConsumptions.reduce(
        (acc, c) => acc + (Number(c.quantity) || 0),
        0
      );

      // Se a atividade não tem nem planejamento nem consumo deste material, pular
      if (totalPlannedInActivity === 0 && totalConsumedInActivity === 0) {
        continue;
      }

      // Regra de Conclusão / Cancelamento:
      // Se a atividade estiver 'concluida' ou 'cancelada', o planejado restante vira 0 (libera reserva)
      const isClosed = act.status === "concluida" || act.status === "cancelada";

      let remainingPlannedQuantity = 0;
      let deviationQuantity = 0;

      if (isClosed) {
        remainingPlannedQuantity = 0;
        deviationQuantity = Math.max(0, totalConsumedInActivity - totalPlannedInActivity);
      } else {
        remainingPlannedQuantity = Math.max(0, totalPlannedInActivity - totalConsumedInActivity);
        deviationQuantity = Math.max(0, totalConsumedInActivity - totalPlannedInActivity);
      }

      linkedActivities.push({
        activityId: act.id,
        orderNumber: act.order_number,
        activityName: act.name,
        serviceType: act.service_type || "Pintura Geral",
        status: act.status,
        progressPercentage: Number(act.progress_percentage) || 0,
        plannedStartDate: act.planned_start_date,
        plannedEndDate: act.planned_end_date,
        plannedQuantity: totalPlannedInActivity,
        consumedQuantity: totalConsumedInActivity,
        remainingPlannedQuantity,
        deviationQuantity,
        unit: material.unit,
      });
    }

    return consolidateMaterialPlanningMetrics(material, linkedActivities);
  });

  return result;
}
