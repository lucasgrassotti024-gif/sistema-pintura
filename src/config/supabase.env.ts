// Configuração centralizada e compatível com as nomenclaturas do Supabase
// Suporta a nomenclatura atual (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) e mantém fallback para a tradicional (NEXT_PUBLIC_SUPABASE_ANON_KEY)
export const supabaseEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  anonKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "",
  isConfigured: Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ),
};
