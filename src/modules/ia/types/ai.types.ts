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

export interface AiEntityMemoryActivity {
  id: string;
  orderNumber: string;
  name: string;
}

export interface AiEntityMemoryMaterial {
  id: string;
  code: string;
  name: string;
}

export interface AiEntityFocus {
  activityId?: string;
  orderNumber?: string;
  activityName?: string;
  materialId?: string;
  materialCode?: string;
  materialName?: string;
  comparisonActivityIds?: string[];
  lastTopic?: "status" | "materiais" | "consumo" | "atraso" | "geral";
}

/**
 * Memória estruturada e compacta de curto prazo (entidade em foco + entidades relacionadas recentes).
 * - 1 entidade principal em foco (ou par de comparação)
 * - Até 4 atividades relacionadas recentes
 * - Até 2 materiais relacionados recentes
 */
export interface AiConversationMemory {
  focusedEntity?: AiEntityFocus;
  recentActivities: AiEntityMemoryActivity[];
  recentMaterials: AiEntityMemoryMaterial[];
}

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
  recentMemory?: AiConversationMemory;
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

/**
 * Registro estruturado de telemetria operacional (sem dados sensíveis, sem chaves).
 */
export interface AiOperationalTelemetry {
  timestampISO: string;
  questionSnippet: string;
  modelUsed: string;
  fallbackUsed: boolean;
  totalDurationMs: number;
  geminiIterations: number;
  toolsExecuted: Array<{ toolName: string; durationMs: number; success: boolean }>;
  hasMemoryContext: boolean;
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
