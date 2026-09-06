import { SupabaseClient } from "@supabase/supabase-js";
import { FunctionDeclaration, Type } from "@google/genai";

export const scheduleDeclarations: FunctionDeclaration[] = [
  {
    name: "consultarProgramacao",
    description:
      "Consulta a programação operacional de frentes de pintura para um dia específico (ex: 'hoje', 'amanhã', '2026-09-07') ou período (semana). Retorna as atividades programadas, equipes alocadas, prazos e frentes ativas que interceptam o período.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        periodo: {
          type: Type.STRING,
          description: "Período temporal: 'hoje', 'amanha', 'esta_semana', 'proxima_semana' ou 'data_especifica'.",
        },
        dataEspecifica: {
          type: Type.STRING,
          description: "Data em formato YYYY-MM-DD quando periodo for 'data_especifica'.",
        },
        equipe: {
          type: Type.STRING,
          description: "Nome da equipe operacional para filtrar (ex: 'Equipe Alfa', 'Equipe Beta').",
        },
      },
      required: ["periodo"],
    },
  },
];

export async function executeScheduleTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  if (toolName !== "consultarProgramacao") {
    return { erro: `Tool de programação desconhecida: ${toolName}` };
  }

  const periodo = typeof args.periodo === "string" ? args.periodo.toLowerCase().trim() : "hoje";
  const equipeFilter = typeof args.equipe === "string" ? args.equipe.trim().toLowerCase() : "";

  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  if (periodo === "amanha" || periodo === "amanhã") {
    startDate.setDate(now.getDate() + 1);
    endDate.setDate(now.getDate() + 1);
  } else if (periodo === "esta_semana") {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    startDate.setDate(now.getDate() + diffToMonday);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 4); // Segunda a Sexta
  } else if (periodo === "proxima_semana") {
    const day = now.getDay();
    const diffToNextMonday = day === 0 ? 1 : 8 - day;
    startDate.setDate(now.getDate() + diffToNextMonday);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 4);
  } else if (periodo === "data_especifica" && typeof args.dataEspecifica === "string") {
    const parsed = new Date(args.dataEspecifica);
    if (!isNaN(parsed.getTime())) {
      startDate = parsed;
      endDate = parsed;
    }
  }

  const startISO = startDate.toISOString().split("T")[0];
  const endISO = endDate.toISOString().split("T")[0];

  // Atividades cuja janela [planned_start_date, planned_end_date] intercepta [startISO, endISO]
  const { data, error } = await supabase
    .from("activities")
    .select(`
      id,
      order_number,
      name,
      status,
      priority,
      progress_percentage,
      planned_start_date,
      planned_end_date,
      areas (name),
      locations (name),
      equipments (name),
      users!activities_assigned_user_id_fkey (full_name),
      teams (name),
      activity_planned_materials (
        custom_material_name,
        planned_quantity,
        unit,
        materials (name, code)
      )
    `)
    .is("archived_at", null)
    .not("status", "in", '("concluida","cancelada")')
    .lte("planned_start_date", endISO)
    .gte("planned_end_date", startISO)
    .order("planned_start_date", { ascending: true });

  if (error) {
    return { erro: `Falha ao consultar programação operacional: ${error.message}` };
  }

  let items = (data || []).map((row: any) => ({
    id: row.id,
    order_number: row.order_number,
    name: row.name,
    status: row.status,
    priority: row.priority,
    progress_percentage: Number(row.progress_percentage || 0),
    planned_start_date: row.planned_start_date,
    planned_end_date: row.planned_end_date,
    area: row.areas?.name || null,
    location: row.locations?.name || null,
    equipment: row.equipments?.name || null,
    responsible: row.users?.full_name || null,
    team: row.teams?.name || null,
    materiais_planejados: (row.activity_planned_materials || []).map((pm: any) => ({
      material: pm.materials?.name || pm.custom_material_name,
      quantidade: Number(pm.planned_quantity),
      unidade: pm.unit,
    })),
  }));

  if (equipeFilter) {
    items = items.filter((i) => i.team?.toLowerCase().includes(equipeFilter));
  }

  return {
    periodo_consultado: {
      tipo: periodo,
      data_inicio: startISO,
      data_fim: endISO,
    },
    total_frentes_programadas: items.length,
    atividades: items,
  };
}
