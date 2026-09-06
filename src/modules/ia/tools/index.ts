import { SupabaseClient } from "@supabase/supabase-js";
import { FunctionDeclaration } from "@google/genai";
import { AiDomain, AiToolExecutionLog } from "../types/ai.types";

import { activitiesDeclarations, executeActivitiesTool } from "./activities.tool";
import { scheduleDeclarations, executeScheduleTool } from "./schedule.tool";
import { inventoryDeclarations, executeInventoryTool } from "./inventory.tool";
import { consumptionDeclarations, executeConsumptionTool } from "./consumption.tool";
import { historyDeclarations, executeHistoryTool } from "./history.tool";
import { alertsDeclarations, executeAlertsTool } from "./alerts.tool";
import { managementDeclarations, executeManagementTool } from "./management.tool";

/**
 * Catálogo completo de declarações de ferramentas da IA dos 7 Domínios Operacionais.
 */
export const ALL_AI_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  ...activitiesDeclarations,
  ...scheduleDeclarations,
  ...inventoryDeclarations,
  ...consumptionDeclarations,
  ...historyDeclarations,
  ...alertsDeclarations,
  ...managementDeclarations,
];

/**
 * Mapeamento de ferramenta para seu respectivo domínio operacional.
 */
const TOOL_DOMAIN_MAP: Record<string, AiDomain> = {
  buscarAtividades: "atividades",
  obterDetalhesAtividade: "atividades",
  consultarProgramacao: "programacao",
  consultarEstoqueMateriais: "estoque",
  consultarConsumo: "consumo",
  consultarHistoricoAuditoria: "historico",
  consultarNotificacoesRecentes: "alertas",
  obterResumoGeralPlanta: "gestao",
  verificarViabilidadeMateriais: "gestao",
};

/**
 * Despachante Central de Tools (Dispatcher).
 * Executa sob a sessão do Supabase (RLS autenticado do usuário), calcula a duração e devolve resposta segura.
 */
export async function dispatchAiTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<{ output: unknown; log: AiToolExecutionLog }> {
  const startTime = Date.now();
  const domain: AiDomain = TOOL_DOMAIN_MAP[toolName] || "gestao";

  // V1 - Segurança Estrita: Bloqueio contra qualquer tentativa de escrita
  const writingKeywords = ["criar", "atualizar", "deletar", "excluir", "cancelar", "salvar", "insert", "update", "delete"];
  const lowerName = toolName.toLowerCase();
  if (writingKeywords.some((w) => lowerName.includes(w))) {
    const durationMs = Date.now() - startTime;
    const output = {
      erro: "Operação não permitida: A IA Operacional atua estritamente em modo consultivo e analítico (somente leitura).",
    };
    return {
      output,
      log: {
        toolName,
        domain,
        params: args,
        success: false,
        durationMs,
        error: "Bloqueio de escrita consultiva",
      },
    };
  }

  let output: unknown;
  let success = true;
  let errorMsg: string | undefined;

  try {
    switch (domain) {
      case "atividades":
        output = await executeActivitiesTool(toolName, args, supabase);
        break;
      case "programacao":
        output = await executeScheduleTool(toolName, args, supabase);
        break;
      case "estoque":
        output = await executeInventoryTool(toolName, args, supabase);
        break;
      case "consumo":
        output = await executeConsumptionTool(toolName, args, supabase);
        break;
      case "historico":
        output = await executeHistoryTool(toolName, args, supabase);
        break;
      case "alertas":
        output = await executeAlertsTool(toolName, args, supabase);
        break;
      case "gestao":
        output = await executeManagementTool(toolName, args, supabase);
        break;
      default:
        output = { erro: `Domínio ou ferramenta não implementada: ${toolName}` };
        success = false;
        errorMsg = "Tool não encontrada";
    }
  } catch (err) {
    success = false;
    errorMsg = err instanceof Error ? err.message : "Erro desconhecido durante execução da tool";
    output = {
      erro: `Falha na consulta operacional da ferramenta ${toolName}: ${errorMsg}`,
    };
  }

  const durationMs = Date.now() - startTime;

  return {
    output,
    log: {
      toolName,
      domain,
      params: args,
      success,
      durationMs,
      error: errorMsg,
    },
  };
}
