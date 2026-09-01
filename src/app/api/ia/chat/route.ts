import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GoogleGenAI, Content, Part } from "@google/genai";
import { SYSTEM_PINTURA_KNOWLEDGE } from "@/modules/ia/services/ia-knowledge";
import { IA_FUNCTION_DECLARATIONS, executeIaTool } from "@/modules/ia/services/ia-tools";
import { getFastPathGreeting } from "@/modules/ia/services/ia-fast-path";

/**
 * Traduz erros técnicos de infraestrutura da nuvem para mensagens amigáveis de engenharia.
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
    return "O assistente de IA está com alta demanda momentânea nos servidores da nuvem. Por favor, aguarde alguns instantes e tente novamente. Os dados da planta continuam disponíveis normalmente nos módulos do sistema.";
  }

  if (
    rawMsg.includes("429") ||
    rawMsg.includes("RESOURCE_EXHAUSTED") ||
    rawMsg.includes("quota") ||
    rawMsg.includes("rate limit")
  ) {
    return "Limite temporário de consultas atingido. Por favor, aguarde um momento antes de enviar uma nova pergunta.";
  }

  return "Não foi possível obter resposta do assistente no momento. Tente novamente em instantes.";
}

/**
 * Cria uma resposta Response em stream SSE com uma mensagem de texto direta.
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

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticação do usuário via sessão Supabase (cookies)
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Operação não autorizada: Usuário não autenticado no sistema." },
        { status: 401 }
      );
    }

    // 2. Extrair payload da requisição
    const body = await req.json();
    const { messages } = body as {
      messages?: Array<{ sender: "user" | "ia"; text: string }>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Requisição inválida: Nenhuma mensagem enviada." },
        { status: 400 }
      );
    }

    const latestUserMessage = messages[messages.length - 1].text.trim();
    if (!latestUserMessage) {
      return NextResponse.json(
        { error: "Mensagem vazia." },
        { status: 400 }
      );
    }

    // 3. Fast-Path: Interceptação de saudações elementares e isoladas (0ms LLM / 0ms DB)
    const fastPathGreeting = getFastPathGreeting(latestUserMessage);
    if (fastPathGreeting) {
      return createSseStreamResponse(fastPathGreeting);
    }

    // 4. Validar se a GEMINI_API_KEY está configurada no servidor
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return createSseStreamResponse(
        "Assistente de IA temporariamente indisponível: Chave de API não configurada no servidor."
      );
    }

    // 5. Instanciar SDK oficial do Google Gemini
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // 6. Montar histórico de conversação multi-turn (últimas 10 mensagens para contexto contínuo)
    const conversationHistory: Content[] = messages.slice(-10).map((m) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const contents: Content[] = [...conversationHistory];

    // 7. Loop de Tool Calling / Function Execution
    const MAX_TOOL_ITERATIONS = 5;
    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const generateResult = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents,
        config: {
          systemInstruction: SYSTEM_PINTURA_KNOWLEDGE,
          tools: [{ functionDeclarations: IA_FUNCTION_DECLARATIONS }],
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });

      const functionCalls = generateResult.functionCalls;

      if (!functionCalls || functionCalls.length === 0) {
        // Nenhuma ferramenta solicitada nesta rodada.
        break;
      }

      // Adiciona o turno com a intenção do modelo de chamar tools
      const candidateContent = generateResult.candidates?.[0]?.content;
      if (candidateContent) {
        contents.push(candidateContent);
      }

      // Executa todas as tools chamadas nesta iteração sob o Supabase RLS
      const toolResponseParts: Part[] = [];

      for (const fc of functionCalls) {
        const toolName = fc.name;
        if (!toolName) continue;
        const toolArgs = (fc.args as Record<string, unknown>) || {};

        let toolOutput: unknown;
        try {
          toolOutput = await executeIaTool(toolName, toolArgs, supabase);
        } catch (toolErr) {
          toolOutput = {
            erro: `Erro na execução da tool ${toolName}: ${
              toolErr instanceof Error ? toolErr.message : "Erro desconhecido"
            }`,
          };
        }

        toolResponseParts.push({
          functionResponse: {
            name: toolName,
            id: fc.id, // Repassa o id da function call para conformidade estrita
            response: { output: toolOutput },
          },
        });
      }

      // Adiciona as respostas das tools como turno do usuário para a próxima iteração
      contents.push({
        role: "user",
        parts: toolResponseParts,
      });
    }

    // 8. Streaming Final da Resposta Sintetizada via Server-Sent Events (SSE)
    const streamResponse = await ai.models.generateContentStream({
      model: "gemini-3.6-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_PINTURA_KNOWLEDGE,
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
          console.error("Erro durante o streaming do Gemini:", streamErr);
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
  } catch (error) {
    // Log técnico completo gravado exclusivamente no servidor
    console.error("[POST /api/ia/chat] Erro capturado:", error);
    const friendlyMessage = getFriendlyErrorMessage(error);
    return createSseStreamResponse(friendlyMessage);
  }
}
