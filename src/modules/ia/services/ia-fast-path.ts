/**
 * Serviço de Fast-Path para Interações Elementares e Saudações Isoladas.
 * 
 * Intercepta saudações simples de forma estritamente conservadora, respondendo
 * localmente com latência de 0ms e sem consumir tokens do Gemini nem executar
 * consultas de dados no Supabase.
 */

// Conjunto estrito de saudações isoladas normalizadas
const ISOLATED_GREETINGS = new Set([
  "oi",
  "ola",
  "olá",
  "bom dia",
  "boa tarde",
  "boa noite",
  "e ai",
  "e aí",
  "eai",
  "opa",
  "salve",
  "ola assistente",
  "olá assistente",
  "oi assistente",
  "ola ia",
  "olá ia",
  "oi ia",
]);

/**
 * Avalia se a mensagem do usuário é estritamente uma saudação isolada.
 * 
 * Regra conservadora: Se contiver qualquer palavra operacional (ex: "atividades", "tinta",
 * "estoque", "os", "qual", "como", "quem", etc.) ou pontuação com desdobramento,
 * retorna null para que o Gemini processe a intenção normalmente.
 */
export function getFastPathGreeting(rawMessage: string): string | null {
  if (!rawMessage) return null;

  // 1. Limpeza básica: remove espaços nas pontas e normaliza pontuações finais repetidas (!, ?, .)
  const trimmed = rawMessage.trim();

  // Se tiver mais de 40 caracteres, não é uma saudação isolada simples
  if (trimmed.length > 40) return null;

  // 2. Normaliza para minúsculas e remove pontuação comum final/inicial
  const normalized = trimmed
    .toLowerCase()
    .replace(/^[!?,.\s]+|[!?,.\s]+$/g, "") // remove pontuações no início e fim
    .replace(/[!?,.]+/g, " ")             // substitui pontuações internas por espaço
    .replace(/\s+/g, " ")                 // colapsa múltiplos espaços em um só
    .trim();

  // 3. Verifica se a frase inteira corresponde a uma saudação isolada conhecida
  if (ISOLATED_GREETINGS.has(normalized)) {
    return "Olá! Sou o Assistente Operacional de Engenharia da Planta. Como posso apoiar seu turno hoje com atividades, frentes de trabalho, estoque de materiais ou cronograma?";
  }

  return null;
}
