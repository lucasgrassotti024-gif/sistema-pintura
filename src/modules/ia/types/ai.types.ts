/**
 * Tipos e interfaces estruturais da IA Operacional do Sistema de Pintura RSS3.
 * V1: Assistente Consultiva e Analítica com Function Calling sobre dados reais.
 */

export type AiDomain =
  | "atividades"
  | "programacao"
  | "estoque"
  | "consumo"
  | "historico"
  | "alertas"
  | "gestao";

/**
 * Contexto operacional transmitido da sessão do usuário para a IA.
 */
export interface AiSessionContext {
  todayISO: string;
  userId: string;
  userFullName?: string;
  currentModule?: string;
  currentActivityId?: string;
  permissions?: string[];
}

/**
 * Registro de execução de uma Tool para observabilidade e logs do orquestrador.
 */
export interface AiToolExecutionLog {
  toolName: string;
  domain: AiDomain;
  params: Record<string, unknown>;
  success: boolean;
  durationMs: number;
  resultSummary?: string;
  error?: string;
}

import { AttachedActivityData, AttachedMaterialData } from "@/modules/chat/types/chat.types";

/**
 * Mensagem do chat de IA para tráfego client-server.
 */
export interface AiChatMessage {
  id: string;
  sender: "user" | "ia";
  text: string;
  timestamp: string;
  isStreaming?: boolean;
  activity?: AttachedActivityData | null;
  material?: AttachedMaterialData | null;
  activities?: AttachedActivityData[];
  materials?: AttachedMaterialData[];
}
