-- ==============================================================================
-- Migration: 20260903000023_fix_planned_materials_rls_and_uniqueness.sql
-- Descrição:
--   1. Concede privilégio de DELETE para authenticated em public.activity_planned_materials
--      e em public.activity_tags.
--   2. Cria políticas RLS de DELETE utilizando public.has_permission('atividades.editar').
--   3. Remove duplicidades preexistentes em public.activity_planned_materials
--      mantendo estritamente o registro mais recente por material e atividade.
--   4. Cria índice único parcial para garantir que o mesmo material_id não seja
--      duplicado na mesma atividade (quando material_id IS NOT NULL).
--   5. Cria índice único condicional para materiais sem catálogo (quando material_id IS NULL)
--      pelo nome normalizado (custom_material_name) e atividade.
-- ==============================================================================

-- 1. CONCESSÃO DE PRIVILÉGIOS (GRANTS)
GRANT DELETE ON public.activity_planned_materials TO authenticated;
GRANT DELETE ON public.activity_tags TO authenticated;

-- 2. POLÍTICAS DE LINHA (RLS POLICIES) PARA EXCLUSÃO (DELETE)
DROP POLICY IF EXISTS "policy_activity_planned_materials_delete_authorized" ON public.activity_planned_materials;
CREATE POLICY "policy_activity_planned_materials_delete_authorized"
ON public.activity_planned_materials
FOR DELETE
TO authenticated
USING (public.has_permission('atividades.editar'));

DROP POLICY IF EXISTS "policy_activity_tags_delete_authorized" ON public.activity_tags;
CREATE POLICY "policy_activity_tags_delete_authorized"
ON public.activity_tags
FOR DELETE
TO authenticated
USING (public.has_permission('atividades.editar'));

-- 3. LIMPEZA SEGURA DE DUPLICIDADES PREEXISTENTES
-- Remove linhas redundantes mantendo o registro de maior id/mais recente
-- Atinge estritamente activity_planned_materials, preservando consumos e estoque
DELETE FROM public.activity_planned_materials a
WHERE a.material_id IS NOT NULL
  AND a.id NOT IN (
    SELECT DISTINCT ON (sub.activity_id, sub.material_id) sub.id
    FROM public.activity_planned_materials sub
    WHERE sub.material_id IS NOT NULL
    ORDER BY sub.activity_id, sub.material_id, sub.created_at DESC, sub.id DESC
  );

DELETE FROM public.activity_planned_materials a
WHERE a.material_id IS NULL
  AND a.id NOT IN (
    SELECT DISTINCT ON (sub.activity_id, lower(trim(sub.custom_material_name))) sub.id
    FROM public.activity_planned_materials sub
    WHERE sub.material_id IS NULL
    ORDER BY sub.activity_id, lower(trim(sub.custom_material_name)), sub.created_at DESC, sub.id DESC
  );

-- 4. GARANTIA DE UNICIDADE NO BANCO DE DADOS
-- A. Impede que o mesmo material_id do catálogo seja planejado mais de uma vez na mesma OS
DROP INDEX IF EXISTS idx_unique_activity_planned_material_id;
CREATE UNIQUE INDEX idx_unique_activity_planned_material_id
ON public.activity_planned_materials (activity_id, material_id)
WHERE material_id IS NOT NULL;

-- B. Impede que o mesmo material avulso ('Outro') com mesmo nome seja planejado mais de uma vez na mesma OS
DROP INDEX IF EXISTS idx_unique_activity_planned_custom_name;
CREATE UNIQUE INDEX idx_unique_activity_planned_custom_name
ON public.activity_planned_materials (activity_id, lower(trim(custom_material_name)))
WHERE material_id IS NULL;
