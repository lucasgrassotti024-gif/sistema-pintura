-- ==============================================================================
-- Migration: 20260823000007_auth_tables_rls_policies.sql
-- Descrição: Cria políticas de leitura (RLS SELECT) estritamente para usuários
--            autenticados nas tabelas de usuários e permissões.
-- Políticas criadas:
--   1. public.users: SELECT somente do próprio perfil (id = auth.uid())
--   2. public.permissions: SELECT de catálogo (true)
--   3. public.role_base_permissions: SELECT da matriz de cargos (true)
--   4. public.user_custom_permissions: SELECT dos próprios overrides (user_id = auth.uid())
-- ==============================================================================

-- 1. Habilitar RLS explicitamente em cada tabela (caso ainda não esteja ativo)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_base_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_permissions ENABLE ROW LEVEL SECURITY;

-- 2. Política em public.users (Apenas o próprio perfil)
DROP POLICY IF EXISTS "policy_users_select_own" ON public.users;
CREATE POLICY "policy_users_select_own"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 3. Política em public.permissions (Catálogo legível por qualquer autenticado)
DROP POLICY IF EXISTS "policy_permissions_select_auth" ON public.permissions;
CREATE POLICY "policy_permissions_select_auth"
ON public.permissions
FOR SELECT
TO authenticated
USING (true);

-- 4. Política em public.role_base_permissions (Matriz de cargos legível por qualquer autenticado)
DROP POLICY IF EXISTS "policy_role_base_permissions_select_auth" ON public.role_base_permissions;
CREATE POLICY "policy_role_base_permissions_select_auth"
ON public.role_base_permissions
FOR SELECT
TO authenticated
USING (true);

-- 5. Política em public.user_custom_permissions (Apenas as próprias exceções)
DROP POLICY IF EXISTS "policy_user_custom_permissions_select_own" ON public.user_custom_permissions;
CREATE POLICY "policy_user_custom_permissions_select_own"
ON public.user_custom_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
