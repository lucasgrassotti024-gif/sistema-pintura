import { SupabaseClient } from "@supabase/supabase-js";
import { FunctionDeclaration, Type } from "@google/genai";

export const alertsDeclarations: FunctionDeclaration[] = [
  {
    name: "consultarNotificacoesRecentes",
    description:
      "Consulta as notificações e alertas operacionais gerados pelo sistema (ocorrências de atividades, prazos vencendo e alertas de insumos críticos).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        apenasNaoLidas: {
          type: Type.BOOLEAN,
          description: "Se true, filtra apenas notificações que ainda não foram marcadas como lidas.",
        },
        severidade: {
          type: Type.STRING,
          description: "Filtrar por severidade: 'urgente', 'alerta' ou 'info'.",
        },
        limite: {
          type: Type.INTEGER,
          description: "Quantidade máxima de notificações a retornar (padrão: 10).",
        },
      },
    },
  },
];

export async function executeAlertsTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  if (toolName !== "consultarNotificacoesRecentes") {
    return { erro: `Tool de alertas desconhecida: ${toolName}` };
  }

  const apenasNaoLidas = Boolean(args.apenasNaoLidas);
  const severidade = typeof args.severidade === "string" ? args.severidade.trim() : "";
  const limite = typeof args.limite === "number" ? Math.min(args.limite, 30) : 10;

  let query = supabase
    .from("notifications")
    .select("id, title, message, severity, category, read, created_at, link_href");

  if (apenasNaoLidas) {
    query = query.eq("read", false);
  }

  if (severidade) {
    query = query.eq("severity", severidade);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) {
    return { erro: `Falha ao consultar notificações: ${error.message}` };
  }

  return {
    total_encontrado: (data || []).length,
    notificacoes: data || [],
  };
}
