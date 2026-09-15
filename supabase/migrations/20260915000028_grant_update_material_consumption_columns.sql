-- ==============================================================================
-- Migration: 20260915000028_grant_update_material_consumption_columns.sql
-- Descrição: Concede privilégios colunares de UPDATE nas novas colunas técnicas
--            de consumo e embalagem de public.materials ao role 'authenticated',
--            respeitando o Princípio do Menor Privilégio consolidado na migration
--            20260825000014_enable_material_edit.sql.
--
-- Colunas contempladas:
--   - consumption_per_m2_per_coat (NUMERIC(10,4))
--   - consumption_unit (VARCHAR(30))
--   - package_type (VARCHAR(50))
--   - package_volume (NUMERIC(10,2))
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CONCESSÃO DE PRIVILÉGIOS COLUNARES DE UPDATE
-- ------------------------------------------------------------------------------
GRANT UPDATE (
    consumption_per_m2_per_coat,
    consumption_unit,
    package_type,
    package_volume
) ON public.materials TO authenticated;

-- Comentário formal no catálogo do PostgreSQL para auditoria
COMMENT ON COLUMN public.materials.consumption_per_m2_per_coat IS 'Taxa teórica de consumo por metro quadrado por demão (L/m²/demão)';
COMMENT ON COLUMN public.materials.consumption_unit IS 'Unidade de medida do consumo teórico (padrão L/m²/demão)';
COMMENT ON COLUMN public.materials.package_type IS 'Denominação comercial da embalagem (ex: Galão, Balde, Lata)';
COMMENT ON COLUMN public.materials.package_volume IS 'Capacidade nominal unitária da embalagem em litros';
