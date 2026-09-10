import { SupabaseClient } from "@supabase/supabase-js";
import { AiSessionContext } from "../types/ai.types";

/**
 * Monta o contexto operacional seguro a partir da sessão autenticada no servidor.
 * Não expõe tokens, senhas ou dados sensíveis.
 */
export async function buildAiSessionContext(
  supabase: SupabaseClient,
  authenticatedUser?: { id: string } | null,
  clientContext?: Partial<AiSessionContext>
): Promise<AiSessionContext> {
  const todayISO = new Date().toISOString().split("T")[0];

  let userId = authenticatedUser?.id;
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
  }

  let userFullName: string | undefined;
  if (userId) {
    const { data: profile } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    userFullName = profile?.full_name;
  }

  return {
    todayISO,
    userId: userId || "anon",
    userFullName: userFullName || clientContext?.userFullName,
    currentModule: clientContext?.currentModule || "pintura",
    currentActivityId: clientContext?.currentActivityId,
    permissions: clientContext?.permissions || [],
    recentMemory: clientContext?.recentMemory,
  };
}
