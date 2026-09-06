import { SupabaseClient } from "@supabase/supabase-js";
import { FunctionDeclaration, Type } from "@google/genai";

export const historyDeclarations: FunctionDeclaration[] = [
  {
    name: "consultarHistoricoAuditoria",
    description:
      "Consulta a trilha de auditoria e linha do tempo de alterações de uma atividade ou os registros recentes da planta (quem alterou, quando, qual campo foi alterado, novos valores e observações técnicas).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        identificadorAtividade: {
          type: Type.STRING,
          description: "Número da OS ou ID da atividade para buscar o histórico específico (ex: 'OS-1001').",
        },
        limite: {
          type: Type.INTEGER,
          description: "Quantidade máxima de registros a retornar (padrão: 10).",
        },
      },
    },
  },
];

export async function executeHistoryTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  if (toolName !== "consultarHistoricoAuditoria") {
    return { erro: `Tool de histórico desconhecida: ${toolName}` };
  }

  const orderNumberOuId = typeof args.identificadorAtividade === "string" ? args.identificadorAtividade.trim() : "";
  const limite = typeof args.limite === "number" ? Math.min(args.limite, 30) : 10;

  let activityId: string | null = null;

  if (orderNumberOuId) {
    const clean = orderNumberOuId.replace(/^os\s+/i, "OS-").trim();
    const { data: act } = await supabase
      .from("activities")
      .select("id, order_number")
      .or(`order_number.ilike.%${clean}%,id.eq.${clean}`)
      .limit(1)
      .maybeSingle();

    if (act) {
      activityId = act.id;
    }
  }

  let query = supabase
    .from("activity_audit_logs")
    .select(`
      id,
      action,
      old_progress,
      new_progress,
      consumed_materials,
      observation,
      field,
      old_value,
      new_value,
      created_at,
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
    return { erro: `Falha ao consultar auditoria: ${error.message}` };
  }

  return {
    total_registros: (data || []).length,
    logs: (data || []).map((l: any) => ({
      id: l.id,
      acao: l.action,
      atividade: l.activities ? `${l.activities.order_number} - ${l.activities.name}` : null,
      usuario: l.users?.full_name || "Sistema",
      campo_alterado: l.field || null,
      valor_anterior: l.old_value || null,
      novo_valor: l.new_value || null,
      progresso_anterior: l.old_progress,
      novo_progresso: l.new_progress,
      materiais_consumidos: l.consumed_materials,
      observacao: l.observation,
      data_hora: l.created_at,
    })),
  };
}
