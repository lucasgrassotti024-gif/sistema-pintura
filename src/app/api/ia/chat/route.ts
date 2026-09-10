import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildAiSessionContext } from "@/modules/ia/services/ai-context.service";
import { orchestrateAiConversation } from "@/modules/ia/services/ai-orchestrator.service";

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticação do usuário via sessão Supabase (cookies/JWT)
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
    const { messages, clientContext } = body as {
      messages?: Array<{ sender: "user" | "ia"; text: string }>;
      clientContext?: {
        currentModule?: string;
        currentActivityId?: string;
        permissions?: string[];
        recentMemory?: any;
      };
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Requisição inválida: Nenhuma mensagem enviada." },
        { status: 400 }
      );
    }

    // 3. Montar contexto operacional da sessão
    const context = await buildAiSessionContext(supabase, user, clientContext);

    // 4. Delegar ao AI Orchestrator
    return await orchestrateAiConversation(messages, context, supabase);
  } catch (error) {
    console.error("[POST /api/ia/chat] Erro não tratado:", error);
    return NextResponse.json(
      { error: "Falha interna ao processar consulta de IA." },
      { status: 500 }
    );
  }
}
