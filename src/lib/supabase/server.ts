import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/config/supabase.env";

/**
 * Cria e retorna o cliente Supabase para execução em Server Components, Server Actions e Route Handlers.
 * Utiliza as práticas recomendadas pelo @supabase/ssr com manipulação de cookies assíncrona do Next.js 15+.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // O método `setAll` foi chamado a partir de um Server Component.
          // Isso pode ser ignorado se houver middleware gerenciando cookies de sessão.
        }
      },
    },
  });
}
