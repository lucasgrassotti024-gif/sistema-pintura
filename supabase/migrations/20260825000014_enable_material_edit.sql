-- ==============================================================================
-- Migration: 20260825000014_enable_material_edit.sql
-- Descrição: Concede privilégios e configura política RLS para edição cadastral
--            de Materiais em public.materials protegida por 'materiais.editar'.
--
-- Regras de Segurança:
--   1. Permite UPDATE exclusivo sobre as colunas cadastrais do material.
--   2. NÃO concede UPDATE sobre current_stock (saldo alterado exclusivamente via RPC).
--   3. Mantém id e created_at protegidos.
--   4. Exige autorização estrita via public.has_permission('materiais.editar').
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CONCESSÃO DE PRIVILÉGIOS COLUNARES (Princípio do Menor Privilégio)
-- ------------------------------------------------------------------------------
GRANT UPDATE (
    code,
    name,
    type,
    manufacturer,
    color,
    unit,
    minimum_stock,
    location,
    technical_info,
    active,
    updated_at
) ON public.materials TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. POLÍTICA DE RLS PARA EDIÇÃO CADASTRAL DE MATERIAIS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "policy_materials_update_authorized" ON public.materials;
CREATE POLICY "policy_materials_update_authorized"
ON public.materials
FOR UPDATE
TO authenticated
USING (
    public.has_permission('materiais.editar')
)
WITH CHECK (
    public.has_permission('materiais.editar')
);
