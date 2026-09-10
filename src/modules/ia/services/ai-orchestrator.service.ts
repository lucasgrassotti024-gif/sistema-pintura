import { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenAI, Content, Part } from "@google/genai";
import { AiSessionContext, AiToolExecutionLog } from "../types/ai.types";
import { AttachedActivityData, AttachedMaterialData } from "@/modules/chat/types/chat.types";
import { OPERATIONAL_AI_SYSTEM_PROMPT } from "../prompts/system.prompt";
import { ALL_AI_TOOL_DECLARATIONS, dispatchAiTool } from "../tools";
import { getFastPathGreeting } from "./ia-fast-path";

/**
 * Ordem de prioridade dos modelos de IA do Google AI Studio para o AI Orchestrator.
 *
 * Configuração otimizada para máxima velocidade e estabilidade (10/09/2026):
 * - MODELO PRINCIPAL: "gemini-3.5-flash-lite"
 *   Status: Ativo, ultrarrápido (sub-segundo para function calling) e quota sem 429.
 *   Latência medida: ~700-1100ms para Function Calling complexo.
 *
 * - FALLBACK 1: "gemini-3.7-flash"
 *   Status: Disponível como contingência robusta para raciocínios operacionais profundos.
 *
 * - FALLBACK 2: "gemini-3.5-flash"
 *   Status: Backup em caso de instabilidade pontual.
 *
 * - FALLBACK 3: "gemini-flash-latest"
 *   Status: Última esteira de contingência operacional.
 */
const FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
];

/**
 * Analisa e traduz erros técnicos do Google Gemini de forma transparente e precisa.
 */
export function getFriendlyErrorMessage(error: unknown): string {
  const rawMsg = error instanceof Error ? error.message : String(error);

  // 1. Cota Diária Esgotada (PerDay)
  if (
    rawMsg.includes("GenerateRequestsPerDay") ||
    (rawMsg.includes("RESOURCE_EXHAUSTED") && rawMsg.includes("day")) ||
    (rawMsg.includes("429") && rawMsg.includes("free_tier_requests"))
  ) {
    return "O limite diário de consultas de IA do plano atual foi atingido no Google AI Studio. A cota será renovada pelo Google no próximo ciclo diário.";
  }

  // 2. Limite Temporário de Taxa (Burst / RPM)
  if (
    rawMsg.includes("429") ||
    rawMsg.includes("RESOURCE_EXHAUSTED") ||
    rawMsg.includes("rate limit") ||
    rawMsg.includes("Too Many Requests")
  ) {
    return "A IA está temporariamente com alto volume de consultas simultâneas no Google. Por favor, aguarde alguns segundos e tente novamente.";
  }

  // 3. Sobrecarga temporária do servidor Google (503 / UNAVAILABLE)
  if (
    rawMsg.includes("503") ||
    rawMsg.includes("high demand") ||
    rawMsg.includes("UNAVAILABLE") ||
    rawMsg.includes("overloaded") ||
    rawMsg.includes("temporarily unavailable")
  ) {
    return "Os servidores de IA do Google estão momentaneamente sobrecarregados. Os dados da planta continuam disponíveis nos módulos do sistema. Aguarde alguns instantes e tente novamente.";
  }

  // 4. Autenticação e Chave de API
  if (rawMsg.includes("API key not valid") || rawMsg.includes("401") || rawMsg.includes("UNAUTHENTICATED")) {
    return "A configuração da chave da IA (GEMINI_API_KEY) está inválida no servidor. Verifique as credenciais do Google AI Studio.";
  }

  // 5. Permissão ou Acesso Bloqueado (403)
  if (rawMsg.includes("403") || rawMsg.includes("PERMISSION_DENIED")) {
    return "Acesso não autorizado aos serviços de IA do Google para este projeto.";
  }

  // 6. Modelo não encontrado (404)
  if (rawMsg.includes("404") || rawMsg.includes("NOT_FOUND")) {
    return "O modelo de IA solicitado não está disponível nesta versão da API.";
  }

  return "Não foi possível obter resposta da IA no momento. Tente novamente em instantes.";
}

/**
 * Cria uma Response com streaming local progressivo (SSE) a partir de um texto já obtido.
 * Transmite pequenos blocos com micro-delays para preservar a experiência de digitação suave
 * no chat sem consumir nenhuma chamada extra à API do Google.
 */
function createLocalStreamingResponse(fullText: string): Response {
  const textEncoder = new TextEncoder();
  const chunkSize = 16; // Caracteres por emissão (ritmo de leitura ágil)

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Envia o primeiro chunk imediatamente sem delay para a UI começar a renderizar no instante 0
        const firstChunk = fullText.slice(0, chunkSize);
        if (firstChunk) {
          controller.enqueue(textEncoder.encode(firstChunk));
        }

        // Emite os chunks subsequentes com micro-delay suave de 4ms
        for (let i = chunkSize; i < fullText.length; i += chunkSize) {
          const chunk = fullText.slice(i, i + chunkSize);
          controller.enqueue(textEncoder.encode(chunk));
          await new Promise((resolve) => setTimeout(resolve, 4));
        }
        controller.close();
      } catch {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Cria uma Response direta sem streaming para saudações e mensagens de erro estáticas.
 */
function createDirectSseResponse(text: string): Response {
  const textEncoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(textEncoder.encode(text));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

/**
 * Helper com retry seguro para erros temporários de rede (503 ou 429 de burst curto).
 */
async function callGeminiWithRetry(
  ai: GoogleGenAI,
  modelName: string,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0]
) {
  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const isTemporary =
        err?.status === 503 ||
        err?.message?.includes("503") ||
        err?.message?.includes("UNAVAILABLE") ||
        (err?.status === 429 && !err?.message?.includes("GenerateRequestsPerDay"));

      if (isTemporary && attempt < maxAttempts) {
        console.warn(`[AI Orchestrator] Tentativa ${attempt} falhou com erro temporário no modelo ${modelName}. Aguardando 1.5s antes do retry...`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Orquestrador Central da IA Operacional (AI Orchestrator).
 * V1: Eliminação estrita de chamadas redundantes de streaming e fallback inteligente de modelos.
 */
export async function orchestrateAiConversation(
  messages: Array<{ sender: "user" | "ia"; text: string }>,
  context: AiSessionContext,
  supabase: SupabaseClient
): Promise<Response> {
  const latestMessage = messages[messages.length - 1]?.text?.trim() || "";
  if (!latestMessage) {
    return createDirectSseResponse("Mensagem vazia recebida.");
  }

  // 1. Fast-path para saudações isoladas (0ms LLM / 0 chamadas de API)
  const fastGreeting = getFastPathGreeting(latestMessage);
  if (fastGreeting) {
    return createDirectSseResponse(fastGreeting);
  }

  // 2. Chave de API
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return createDirectSseResponse(
      "Assistente de IA temporariamente indisponível: Chave de API não configurada no servidor."
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  // 3. Montar instrução do sistema contextualizada
  const systemInstruction = `
${OPERATIONAL_AI_SYSTEM_PROMPT}

## CONTEXTO OPERACIONAL DO TURNO:
- Data de Referência do Sistema (Hoje): ${context.todayISO}
- Usuário Conectado: ${context.userFullName || "Operador do Sistema"}
- Módulo Atual na Interface: ${context.currentModule || "Geral"}
`;

  // 4. Histórico de conversação multi-turn (últimas 10 mensagens)
  const conversationHistory: Content[] = messages.slice(-10).map((m) => ({
    role: m.sender === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  const startTimeTotal = Date.now();
  let lastError: unknown = null;

  // 5. Tentar a lista de modelos (com fallback se o primário sofrer esgotamento de cota diária ou 404)
  for (const currentModel of FALLBACK_MODELS) {
    const contents: Content[] = [...conversationHistory];
    const MAX_TOOL_ITERATIONS = 5;
    let iteration = 0;
    let geminiApiCallCount = 0;
    const executionLogs: AiToolExecutionLog[] = [];
    let finalText = "";
    const collectedActivities: AttachedActivityData[] = [];
    const collectedMaterials: AttachedMaterialData[] = [];

    try {
      while (iteration < MAX_TOOL_ITERATIONS) {
        iteration++;
        geminiApiCallCount++;

        const generateResult = await callGeminiWithRetry(ai, currentModel, {
          model: currentModel,
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: ALL_AI_TOOL_DECLARATIONS }],
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        });

        if (!generateResult) break;

        const functionCalls = generateResult.functionCalls;

        // Se o modelo NÃO solicitou mais tools, significa que ele já sintetizou a resposta final
        if (!functionCalls || functionCalls.length === 0) {
          finalText = generateResult.text || "";
          break;
        }

        // Adiciona a intenção da chamada de tools ao histórico
        const candidateContent = generateResult.candidates?.[0]?.content;
        if (candidateContent) {
          contents.push(candidateContent);
        }

        // Executa as tools sob RLS do usuário no Supabase em PARALELO (reduz latência total)
        const toolPromises = functionCalls.map(async (fc) => {
          const toolName = fc.name;
          if (!toolName) return null;
          const toolArgs = (fc.args as Record<string, unknown>) || {};
          const { output, log } = await dispatchAiTool(toolName, toolArgs, supabase);
          return { fc, toolName, output, log };
        });

        const toolExecResults = await Promise.all(toolPromises);

        const toolResponseParts: Part[] = [];
        for (const res of toolExecResults) {
          if (!res) continue;
          const { fc, toolName, output, log } = res;
          executionLogs.push(log);

          // Coleta entidades reais retornadas pelas tools para alimentar os cards do chat
          try {
            const outAny = output as any;
            if (toolName === "obterDetalhesAtividade" && outAny?.encontrada && outAny?.atividade) {
              const act = outAny.atividade;
              if (!collectedActivities.some((a) => a.id === act.id || a.orderNumber === act.order_number)) {
                collectedActivities.push({
                  id: act.id,
                  orderNumber: act.order_number,
                  name: act.name,
                  status: act.status,
                  priority: act.priority,
                  progressPercentage: Number(act.progress_percentage || 0),
                  plannedEndDate: act.planned_end_date,
                  areaName: act.area || undefined,
                  assignedTo: act.responsible || undefined,
                });
              }
            } else if (toolName === "buscarAtividades" && Array.isArray(outAny?.atividades)) {
              // Limita até 5 atividades principais nos cards para não poluir a tela
              for (const act of outAny.atividades.slice(0, 5)) {
                if (!collectedActivities.some((a) => a.id === act.id || a.orderNumber === act.order_number)) {
                  collectedActivities.push({
                    id: act.id,
                    orderNumber: act.order_number,
                    name: act.name,
                    status: act.status,
                    priority: act.priority,
                    progressPercentage: Number(act.progress_percentage || 0),
                    plannedEndDate: act.planned_end_date,
                    areaName: act.area || undefined,
                    assignedTo: act.responsible || undefined,
                  });
                }
              }
            } else if (toolName === "consultarProgramacao" && Array.isArray(outAny?.atividades)) {
              for (const act of outAny.atividades.slice(0, 5)) {
                if (!collectedActivities.some((a) => a.id === act.id || a.orderNumber === act.order_number)) {
                  collectedActivities.push({
                    id: act.id,
                    orderNumber: act.order_number,
                    name: act.name,
                    status: act.status,
                    priority: act.priority,
                    progressPercentage: Number(act.progress_percentage || 0),
                    plannedEndDate: act.planned_end_date,
                    areaName: act.area || undefined,
                    assignedTo: act.responsible || undefined,
                  });
                }
              }
            } else if (toolName === "consultarEstoqueMateriais" && Array.isArray(outAny?.materiais)) {
              // Adiciona até 3 materiais citados
              for (const mat of outAny.materiais.slice(0, 3)) {
                if (!collectedMaterials.some((m) => m.id === mat.id || (mat.code && m.code === mat.code))) {
                  collectedMaterials.push({
                    id: mat.id,
                    code: mat.code,
                    name: mat.name,
                    type: mat.type,
                    unit: mat.unit,
                    currentStock: Number(mat.current_stock || 0),
                    minimumStock: Number(mat.minimum_stock || 0),
                    status: mat.situacao_estoque,
                  });
                }
              }
            } else if (toolName === "verificarViabilidadeMateriais" && Array.isArray(outAny?.itens_avaliados)) {
              for (const item of outAny.itens_avaliados.slice(0, 3)) {
                if (!collectedMaterials.some((m) => m.name === item.material_nome || (item.material_codigo && m.code === item.material_codigo))) {
                  collectedMaterials.push({
                    id: item.material_id || `mat-viab-${item.material_nome}`,
                    code: item.material_codigo || "MAT",
                    name: item.material_nome,
                    type: "Insumo Crítico",
                    unit: item.unidade || "L",
                    currentStock: Number(item.estoque_atual || 0),
                    minimumStock: Number(item.demanda_total || 0),
                    status: item.status_viabilidade === "defasado" ? "critico" : "adequado",
                  });
                }
              }
            }
          } catch {
            // Não bloqueia a execução da tool caso a extração de card falhe
          }

          toolResponseParts.push({
            functionResponse: {
              name: toolName,
              id: fc.id,
              response: { output },
            },
          });
        }

        // Devolve os dados das tools ao Gemini para a próxima iteração
        contents.push({
          role: "user",
          parts: toolResponseParts,
        });
      }

      // 6. Observabilidade e Auditoria de Chamadas
      const totalDuration = Date.now() - startTimeTotal;
      console.info(
        `[AI Orchestrator] Pergunta: "${latestMessage.substring(0, 45)}" | Modelo: ${currentModel} | Requests Gemini: ${geminiApiCallCount} | Tools: ${
          executionLogs.map((l) => `${l.toolName}(${l.durationMs}ms)`).join(", ") || "nenhuma"
        } | Duração Total: ${totalDuration}ms`
      );

      // 7. O Gemini JÁ gerou o texto final no loop.
      // Se houver referências coletadas reais, empacotamos no final do texto para o cliente decodificar
      if (finalText) {
        let payloadWithEntities = finalText;
        if (collectedActivities.length > 0 || collectedMaterials.length > 0) {
          const refsJson = JSON.stringify({
            activities: collectedActivities,
            materials: collectedMaterials,
          });
          payloadWithEntities = `${finalText}\n<!--REFERENCES:${refsJson}-->`;
        }

        return createLocalStreamingResponse(payloadWithEntities);
      }

      // Se porventura o texto vier vazio (caso atípico), retorna aviso técnico
      return createDirectSseResponse("Não foi possível consolidar uma resposta operacional para esta solicitação.");
    } catch (err: any) {
      lastError = err;
      const shouldFallback =
        err?.message?.includes("GenerateRequestsPerDay") ||
        err?.message?.includes("free_tier_requests") ||
        err?.status === 404 ||
        err?.status === 503 ||
        err?.message?.includes("UNAVAILABLE") ||
        err?.message?.includes("high demand");

      if (shouldFallback) {
        console.warn(`[AI Orchestrator] Modelo ${currentModel} falhou com erro recuperável via fallback (${err?.status || err?.message}). Chaveando para o próximo modelo...`);
        continue;
      }

      // Se for outro erro não recuperável por troca de modelo (ex: 401, 403), interrompe
      break;
    }
  }

  // Se todos os modelos falharem
  console.error("[AI Orchestrator] Todos os modelos falharam. Erro final:", lastError);
  const friendlyMsg = getFriendlyErrorMessage(lastError);
  return createDirectSseResponse(friendlyMsg);
}
