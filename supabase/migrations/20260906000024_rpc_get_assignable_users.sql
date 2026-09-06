-- ==============================================================================
-- Migration: 20260906000024_rpc_get_assignable_users.sql
-- Descrição: Cria a função RPC SECURITY DEFINER `get_assignable_users` para
--            retornar a lista segura de usuários ativos que podem ser atribuídos
--            como responsáveis operacionais por atividades de pintura.
--
-- Regras de Segurança:
--   1. Função com SECURITY DEFINER e search_path estritamente controlado.
--   2. Retorna SOMENTE o mínimo necessário: id (UUID) e full_name (VARCHAR).
--   3. Não expõe emails, senhas, tokens, hashes ou dados sensíveis.
--   4. Filtra estritamente usuários ativos (active = true).
--   5. GRANT EXECUTE concedido estritamente para a role 'authenticated'.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_assignable_users()
RETURNS TABLE (
    id UUID,
    full_name VARCHAR(150)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.full_name
    FROM public.users u
    WHERE u.active = true
    ORDER BY u.full_name ASC;
END;
$$;

-- Revoga privilégios públicos e concede estritamente para usuários autenticados
REVOKE ALL ON FUNCTION public.get_assignable_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assignable_users() TO authenticated;
