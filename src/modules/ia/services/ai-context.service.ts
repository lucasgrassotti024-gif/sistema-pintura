import { SupabaseClient } from "@supabase/supabase-js";
import { AiSessionContext } from "../types/ai.types";

/**
 * Monta o contexto operacional seguro a partir da sessão autenticada no servidor.
 * Não expõe tokens, senhas ou dados sensíveis.
 */
export async function buildAiSessionContext(
  supabase: SupabaseClient,
  clientContext?: Partial<AiSessionContext>
): Promise<AiSessionContext> {
  const todayISO = new Date().toISOString().split("T")[0];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userFullName: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    userFullName = profile?.full_name;
  }

  return {
    todayISO,
    userId: user?.id || "anon",
    userFullName: userFullName || clientContext?.userFullName,
    currentModule: clientContext?.currentModule || "pintura",
    currentActivityId: clientContext?.currentActivityId,
    permissions: clientContext?.permissions || [],
  };
}
