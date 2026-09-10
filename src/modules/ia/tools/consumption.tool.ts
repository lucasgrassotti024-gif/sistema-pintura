import { SupabaseClient } from "@supabase/supabase-js";
import { FunctionDeclaration, Type } from "@google/genai";
import { calculatePlannedVsConsumed } from "../rules/operational-analytics.rules";

export const consumptionDeclarations: FunctionDeclaration[] = [
  {
    name: "consultarConsumo",
    description:
      "Consulta os apontamentos reais de consumo de tintas e insumos realizados na planta. Permite analisar o consumo acumulado de uma OS específica, comparar com o que estava planejado ou auditar consumos por material.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        identificadorAtividade: {
          type: Type.STRING,
          description: "Número da OS ou ID da atividade para analisar consumo (ex: 'OS-1001', 'OS-1025').",
        },
        nomeOuCodigoMaterial: {
          type: Type.STRING,
          description: "Nome ou código do material para filtrar consumos (ex: 'epóxi', 'MAT-001').",
        },
        limite: {
          type: Type.INTEGER,
          description: "Quantidade máxima de registros a retornar (padrão: 20).",
        },
      },
    },
  },
];

export async function executeConsumptionTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  if (toolName !== "consultarConsumo") {
    return { erro: `Tool de consumo desconhecida: ${toolName}` };
  }

  const rawIdentificador = typeof args.identificadorAtividade === "string" ? args.identificadorAtividade.trim() : "";
  const materialBusca = typeof args.nomeOuCodigoMaterial === "string" ? args.nomeOuCodigoMaterial.trim().toLowerCase() : "";
  const limite = typeof args.limite === "number" ? Math.min(args.limite, 50) : 20;

  let activityId: string | null = null;
  let activityOrderNumber: string | null = null;
  let plannedMaterialsList: any[] = [];

  if (rawIdentificador) {
    const clean = rawIdentificador.replace(/^os\s+/i, "OS-").trim();
    const { data: act } = await supabase
      .from("activities")
      .select(`
        id,
        order_number,
        name,
        activity_planned_materials (
          id,
          custom_material_name,
          planned_quantity,
          unit,
          materials (id, code, name)
        )
      `)
      .or(`order_number.ilike.%${clean}%,id.eq.${clean}`)
      .limit(1)
      .maybeSingle();

    if (act) {
      activityId = act.id;
      activityOrderNumber = act.order_number;
      plannedMaterialsList = act.activity_planned_materials || [];
    }
  }

  let query = supabase
    .from("activity_consumptions")
    .select(`
      id,
      activity_id,
      quantity,
      unit,
      custom_material_name,
      created_at,
      materials (id, code, name),
      activities (order_number, name),
      users (full_name)
    `);

  if (activityId) {
    query = query.eq("activity_id", activityId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) {
    return { erro: `Falha ao consultar histórico de consumos: ${error.message}` };
  }

  let consumptions = (data || []).map((c: any) => ({
    id: c.id,
    ordem_servico: c.activities?.order_number || activityOrderNumber || "OS não identificada",
    atividade_nome: c.activities?.name || null,
    material: c.materials?.name || c.custom_material_name || "Insumo",
    codigo_material: c.materials?.code || null,
    quantidade_consumida: Number(c.quantity),
    unidade: c.unit,
    data_registro: c.created_at,
    registrado_por: c.users?.full_name || "Operador",
  }));

  if (materialBusca) {
    consumptions = consumptions.filter(
      (c) =>
        c.material.toLowerCase().includes(materialBusca) ||
        (c.codigo_material && c.codigo_material.toLowerCase().includes(materialBusca))
    );
  }

  // Se consultou uma OS específica, compila comparativo Planejado vs. Realizado usando regra pura determinística
  let comparativoPlanejadoRealizado: any[] | null = null;
  if (activityId && plannedMaterialsList.length > 0) {
    comparativoPlanejadoRealizado = plannedMaterialsList.map((pm: any) => {
      const matName = pm.materials?.name || pm.custom_material_name;
      const plannedQty = Number(pm.planned_quantity || 0);

      // Soma consumos dessa OS para o mesmo material
      const totalConsumed = consumptions
        .filter((c) => c.material.toLowerCase() === matName.toLowerCase())
        .reduce((sum, c) => sum + c.quantidade_consumida, 0);

      const calc = calculatePlannedVsConsumed(plannedQty, totalConsumed);

      return {
        material: matName,
        quantidade_planejada: calc.planned,
        quantidade_consumida_real: calc.consumed,
        saldo_restante_a_consumir: calc.remaining,
        unidade: pm.unit,
        percentual_atendido: calc.percentConsumed,
        totalmente_consumido: calc.isFullyConsumed,
        excedeu_planejado: calc.isOverconsumed,
        quantidade_excedente: calc.overconsumedAmount,
        status: calc.isOverconsumed ? "acima_do_planejado" : calc.isFullyConsumed ? "conforme" : "abaixo_do_planejado",
      };
    });
  }

  const possuiConsumoRegistrado = consumptions.length > 0;
  const possuiPlanejamentoCadastrado = plannedMaterialsList.length > 0;

  return {
    possui_consumo_registrado: possuiConsumoRegistrado,
    possui_planejamento_cadastrado: possuiPlanejamentoCadastrado,
    total_apontamentos: consumptions.length,
    apontamentos: consumptions,
    comparativo_planejado_vs_realizado: comparativoPlanejadoRealizado,
  };
}
