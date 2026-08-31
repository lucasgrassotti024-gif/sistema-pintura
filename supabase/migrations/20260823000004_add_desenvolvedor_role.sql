-- ==============================================================================
-- Migration: 20260823000004_add_desenvolvedor_role.sql
-- Descrição: Cria o cargo de sistema 'desenvolvedor', atualiza as constraints
--            de validação de role em public.users e public.role_base_permissions,
--            concede todas as 17 permissões do catálogo ao novo cargo e
--            promove SOMENTE o perfil do usuário especificado por UUID.
-- ==============================================================================

-- 1. Atualizar a constraint de validação de role em public.users
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS chk_user_role;

ALTER TABLE public.users 
ADD CONSTRAINT chk_user_role 
CHECK (role IN ('operador', 'inspetor', 'coordenador', 'administrador', 'desenvolvedor'));

-- 2. Atualizar a constraint de validação de role em public.role_base_permissions
ALTER TABLE public.role_base_permissions 
DROP CONSTRAINT IF EXISTS chk_base_perm_role;

ALTER TABLE public.role_base_permissions 
ADD CONSTRAINT chk_base_perm_role 
CHECK (role IN ('operador', 'inspetor', 'coordenador', 'administrador', 'desenvolvedor'));

-- 3. Inserir todas as 17 permissões existentes do catálogo para o cargo 'desenvolvedor'
INSERT INTO public.role_base_permissions (role, permission_id)
SELECT 'desenvolvedor', id 
FROM public.permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- 4. Promover SOMENTE o perfil do usuário especificado via UUID
UPDATE public.users 
SET 
    role = 'desenvolvedor',
    updated_at = now()
WHERE id = '5a5f1943-8a23-4fda-a065-1d441473b5bb';
