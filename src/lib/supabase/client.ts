import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "@/config/supabase.env";

/**
 * Cria e retorna o cliente Supabase para execução em componentes de cliente (Browser / Client Components).
 * Utiliza as práticas recomendadas pelo @supabase/ssr.
 */
export function createClient() {
  if (!supabaseEnv.url || !supabaseEnv.anonKey) {
    console.warn(
      "Supabase não configurado: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não informados no ambiente."
    );
  }

  return createBrowserClient(supabaseEnv.url, supabaseEnv.anonKey);
}
