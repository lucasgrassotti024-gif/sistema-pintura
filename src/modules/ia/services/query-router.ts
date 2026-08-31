import { IaRouterResult, IaIntentType } from "../types/ia.types";

/**
 * Classificador e Roteador Determinístico de Consultas para a IA Operacional.
 *
 * Garante que o modelo de IA NUNCA decida quais tabelas ou queries executar.
 * A pergunta é classificada por padrões léxicos e expressões regulares rígidas,
 * direcionando exclusivamente para uma consulta fechada e segura no Supabase.
 */
export function routeOperationalQuery(rawQuery: string): IaRouterResult {
  const query = rawQuery.trim().toLowerCase();

  // 1. Detectar menção a Ordem de Serviço Específica (ex: OS-1001, OS-2026-001, OS 102, #1002)
  const osRegex = /\b(os[-_\s]?\d+(?:[-_]\d+)?)\b/i;
  const osMatch = rawQuery.match(osRegex);

  if (osMatch) {
    const rawMatch = osMatch[1];
    // Normalizar para formato OS-XXXX
    const normalizedOs = rawMatch.replace(/\s+/g, "-").toUpperCase();
    return {
      intent: "atividade_especifica",
      orderNumber: normalizedOs,
      matchedKeywords: [normalizedOs],
    };
  }

  // 2. Detectar menção a Atrasos e Vencimentos
  if (
    query.includes("atrasad") ||
    query.includes("atraso") ||
    query.includes("vencid") ||
    query.includes("em atraso") ||
    query.includes("atrasando")
  ) {
    return {
      intent: "atrasos",
      matchedKeywords: ["atraso", "vencido"],
    };
  }

  // 3. Detectar menção a Prazos Próximos / Cronograma / Amanhã / Semana
  if (
    query.includes("amanhã") ||
    query.includes("amanha") ||
    query.includes("prazo") ||
    query.includes("vencem") ||
    query.includes("vence") ||
    query.includes("programaç") ||
    query.includes("programac") ||
    query.includes("cronograma") ||
    query.includes("semana")
  ) {
    return {
      intent: "prazos",
      matchedKeywords: ["prazo", "programação"],
    };
  }

  // 4. Detectar menção a Riscos Operacionais / Alertas Críticos
  if (
    query.includes("risco") ||
    query.includes("crític") ||
    query.includes("critic") ||
    query.includes("atenção") ||
    query.includes("atencao") ||
    query.includes("perigo") ||
    query.includes("parar") ||
    query.includes("parada") ||
    query.includes("compromet")
  ) {
    return {
      intent: "riscos_operacionais",
      matchedKeywords: ["risco", "alerta"],
    };
  }

  // 5. Detectar menção a Consumo / Apontamentos de Insumos
  if (
    query.includes("consum") ||
    query.includes("gasto") ||
    query.includes("gastamos") ||
    query.includes("gastou") ||
    query.includes("aplicad") ||
    query.includes("utilizad")
  ) {
    return {
      intent: "consumo",
      matchedKeywords: ["consumo"],
    };
  }

  // 6. Detectar menção a Estoque / Saldo / Almoxarifado / Ruptura
  if (
    query.includes("estoque") ||
    query.includes("saldo") ||
    query.includes("falta") ||
    query.includes("faltando") ||
    query.includes("insumo") ||
    query.includes("material") ||
    query.includes("materiais") ||
    query.includes("tinta") ||
    query.includes("primer") ||
    query.includes("diluente") ||
    query.includes("solvente")
  ) {
    return {
      intent: "estoque",
      matchedKeywords: ["estoque", "material"],
    };
  }

  // 7. Detectar menção a Atividades em Geral
  if (
    query.includes("atividade") ||
    query.includes("atividades") ||
    query.includes("frente") ||
    query.includes("frentes") ||
    query.includes("ordem de serviço") ||
    query.includes("ordens") ||
    query.includes("serviço")
  ) {
    return {
      intent: "atividades",
      matchedKeywords: ["atividades"],
    };
  }

  // 8. Fallback Seguro: Panorama Geral Operacional Limitado
  return {
    intent: "panorama",
    matchedKeywords: ["panorama_geral_default"],
  };
}
