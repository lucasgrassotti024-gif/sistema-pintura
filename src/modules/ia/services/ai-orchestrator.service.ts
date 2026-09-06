import { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenAI, Content, Part } from "@google/genai";
import { AiSessionContext, AiToolExecutionLog } from "../types/ai.types";
import { OPERATIONAL_AI_SYSTEM_PROMPT } from "../prompts/system.prompt";
import { ALL_AI_TOOL_DECLARATIONS, dispatchAiTool } from "../tools";
import { getFastPathGreeting } from "./ia-fast-path";

/**
 * Traduz erros técnicos de nuvem/infraestrutura para mensagens amigáveis de engenharia.
 */
function getFriendlyErrorMessage(error: unknown): string {
  const rawMsg = error instanceof Error ? error.message : String(error);

  if (
    rawMsg.includes("503") ||
    rawMsg.includes("high demand") ||
    rawMsg.includes("UNAVAILABLE") ||
    rawMsg.includes("overloaded") ||
    rawMsg.includes("temporarily unavailable")
  ) {
    return "O assistente de IA está com alta demanda momentânea nos servidores da nuvem. Os dados da planta continuam disponíveis normalmente nos módulos do sistema. Por favor, aguarde alguns instantes e pergunte novamente.";
  }

  if (
    rawMsg.includes("429") ||
    rawMsg.includes("RESOURCE_EXHAUSTED") ||
    rawMsg.includes("quota") ||
    rawMsg.includes("rate limit")
  ) {
    return "Limite temporário de consultas atingido. Por favor, aguarde alguns instantes antes de enviar uma nova pergunta.";
  }

  return "Não foi possível obter resposta do assistente no momento. Tente novamente em instantes.";
}

/**
 * Cria uma Response em stream SSE direta para saudações e fallbacks rápidos.
 */
function createSseStreamResponse(text: string): Response {
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
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Orquestrador Central da IA Operacional (AI Orchestrator).
 * Coordena o raciocínio do modelo Gemini, execução determinística de tools e streaming final.
 */
export async function orchestrateAiConversation(
  messages: Array<{ sender: "user" | "ia"; text: string }>,
  context: AiSessionContext,
  supabase: SupabaseClient
): Promise<Response> {
  const latestMessage = messages[messages.length - 1]?.text?.trim() || "";
  if (!latestMessage) {
    return createSseStreamResponse("Mensagem vazia recebida.");
  }

  // 1. Fast-path de saudações elementares (0ms LLM / 0ms DB)
  const fastGreeting = getFastPathGreeting(latestMessage);
  if (fastGreeting) {
    return createSseStreamResponse(fastGreeting);
  }

  // 2. Chave de API do Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return createSseStreamResponse(
      "Assistente de IA temporariamente indisponível: Chave de API não configurada no servidor."
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  // 3. Montar instrução do sistema contextualizada com dados reais do turno
  const systemInstruction = `
${OPERATIONAL_AI_SYSTEM_PROMPT}

## CONTEXTO OPERACIONAL DO TURNO:
- Data de Referência do Sistema (Hoje): ${context.todayISO}
- Usuário Conectado: ${context.userFullName || "Operador do Sistema"}
- Módulo Atual na Interface: ${context.currentModule || "Geral"}
`;

  // 4. Histórico multi-turn (últimas 10 mensagens)
  const conversationHistory: Content[] = messages.slice(-10).map((m) => ({
    role: m.sender === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  const contents: Content[] = [...conversationHistory];

  // 5. Loop de Function Calling (Orquestração de Múltiplas Tools)
  const MAX_TOOL_ITERATIONS = 5;
  let iteration = 0;
  const executionLogs: AiToolExecutionLog[] = [];

  try {
    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const generateResult = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: ALL_AI_TOOL_DECLARATIONS }],
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });

      const functionCalls = generateResult.functionCalls;

      if (!functionCalls || functionCalls.length === 0) {
        // Nenhuma ferramenta necessária nesta rodada (ou já coletou todos os dados)
        break;
      }

      // Adiciona o turno com a intenção do modelo de chamar ferramentas
      const candidateContent = generateResult.candidates?.[0]?.content;
      if (candidateContent) {
        contents.push(candidateContent);
      }

      // Executa as tools chamadas sob RLS do usuário
      const toolResponseParts: Part[] = [];

      for (const fc of functionCalls) {
        const toolName = fc.name;
        if (!toolName) continue;
        const toolArgs = (fc.args as Record<string, unknown>) || {};

        const { output, log } = await dispatchAiTool(toolName, toolArgs, supabase);
        executionLogs.push(log);

        toolResponseParts.push({
          functionResponse: {
            name: toolName,
            id: fc.id,
            response: { output },
          },
        });
      }

      // Devolve os resultados das ferramentas ao Gemini para a próxima rodada de raciocínio
      contents.push({
        role: "user",
        parts: toolResponseParts,
      });
    }

    // 6. Log operacional resumido para observabilidade
    if (executionLogs.length > 0) {
      console.info(`[AI Orchestrator] Pergunta: "${latestMessage.substring(0, 60)}" | Tools executadas: ${executionLogs.map((l) => `${l.toolName}(${l.durationMs}ms)`).join(", ")}`);
    }

    // 7. Streaming da Síntese Final via Server-Sent Events (SSE)
    const streamResponse = await ai.models.generateContentStream({
      model: "gemini-3.6-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });

    const textEncoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResponse) {
            const chunkText = chunk.text || "";
            if (chunkText) {
              controller.enqueue(textEncoder.encode(chunkText));
            }
          }
          controller.close();
        } catch (streamErr) {
          console.error("[AI Orchestrator] Erro no streaming de resposta:", streamErr);
          const friendlyFallback = getFriendlyErrorMessage(streamErr);
          controller.enqueue(textEncoder.encode(`\n\n${friendlyFallback}`));
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
  } catch (orchestrationError) {
    console.error("[AI Orchestrator] Erro de orquestração:", orchestrationError);
    const friendlyMessage = getFriendlyErrorMessage(orchestrationError);
    return createSseStreamResponse(friendlyMessage);
  }
}
