-- ==============================================================================
-- Migration: 20260915000027_material_consumption_calculation.sql
-- Descrição: Implementa o modelo de cálculo de consumo de tintas por área:
--   1. Adiciona propriedades técnicas de consumo e embalagem em public.materials:
--      - consumption_per_m2_per_coat (NUMERIC(10,4), L/m²/demão)
--      - consumption_unit (VARCHAR(30), default 'L/m²/demão')
--      - package_type (VARCHAR(50), ex: 'Galão', 'Balde', 'Lata')
--      - package_volume (NUMERIC(10,2), volume unitário em litros)
--   2. Adiciona campos de snapshot técnico do planejamento em public.activity_planned_materials:
--      - area_m2 (NUMERIC(10,2))
--      - coats (INTEGER)
--      - consumption_per_m2_per_coat (NUMERIC(10,4))
--      - package_type (VARCHAR(50))
--      - package_volume (NUMERIC(10,2))
--      - packages_required (INTEGER)
--   3. Todos os campos adicionados são NULLABLE para garantir 100% de compatibilidade
--      com os registros e dados preexistentes.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSÃO DA TABELA public.materials (Catálogo de Materiais)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Consumo técnico por m² por demão
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'consumption_per_m2_per_coat'
    ) THEN
        ALTER TABLE public.materials
        ADD COLUMN consumption_per_m2_per_coat NUMERIC(10,4);
    END IF;

    -- Unidade técnica de consumo
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'consumption_unit'
    ) THEN
        ALTER TABLE public.materials
        ADD COLUMN consumption_unit VARCHAR(30) DEFAULT 'L/m²/demão';
    END IF;

    -- Tipo de embalagem comercial
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'package_type'
    ) THEN
        ALTER TABLE public.materials
        ADD COLUMN package_type VARCHAR(50);
    END IF;

    -- Volume da embalagem comercial em litros
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'package_volume'
    ) THEN
        ALTER TABLE public.materials
        ADD COLUMN package_volume NUMERIC(10,2);
    END IF;
END $$;

-- Constraints de validação defensiva em materials
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS chk_materials_consumption_positive;
ALTER TABLE public.materials ADD CONSTRAINT chk_materials_consumption_positive
    CHECK (consumption_per_m2_per_coat IS NULL OR consumption_per_m2_per_coat > 0);

ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS chk_materials_package_volume_positive;
ALTER TABLE public.materials ADD CONSTRAINT chk_materials_package_volume_positive
    CHECK (package_volume IS NULL OR package_volume > 0);

-- ------------------------------------------------------------------------------
-- 2. EXTENSÃO DA TABELA public.activity_planned_materials (Snapshot de Planejamento)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Área calculada (m²)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'activity_planned_materials' AND column_name = 'area_m2'
    ) THEN
        ALTER TABLE public.activity_planned_materials
        ADD COLUMN area_m2 NUMERIC(10,2);
    END IF;

    -- Quantidade de demãos
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'activity_planned_materials' AND column_name = 'coats'
    ) THEN
        ALTER TABLE public.activity_planned_materials
        ADD COLUMN coats INTEGER;
    END IF;

    -- Snapshot do consumo por m²/demão congelado no planejamento
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'activity_planned_materials' AND column_name = 'consumption_per_m2_per_coat'
    ) THEN
        ALTER TABLE public.activity_planned_materials
        ADD COLUMN consumption_per_m2_per_coat NUMERIC(10,4);
    END IF;

    -- Snapshot do tipo de embalagem congelado
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'activity_planned_materials' AND column_name = 'package_type'
    ) THEN
        ALTER TABLE public.activity_planned_materials
        ADD COLUMN package_type VARCHAR(50);
    END IF;

    -- Snapshot do volume da embalagem congelado
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'activity_planned_materials' AND column_name = 'package_volume'
    ) THEN
        ALTER TABLE public.activity_planned_materials
        ADD COLUMN package_volume NUMERIC(10,2);
    END IF;

    -- Quantidade de embalagens calculada (arredondada para cima)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'activity_planned_materials' AND column_name = 'packages_required'
    ) THEN
        ALTER TABLE public.activity_planned_materials
        ADD COLUMN packages_required INTEGER;
    END IF;
END $$;

-- Constraints defensivas em activity_planned_materials
ALTER TABLE public.activity_planned_materials DROP CONSTRAINT IF EXISTS chk_planned_materials_area_positive;
ALTER TABLE public.activity_planned_materials ADD CONSTRAINT chk_planned_materials_area_positive
    CHECK (area_m2 IS NULL OR area_m2 > 0);

ALTER TABLE public.activity_planned_materials DROP CONSTRAINT IF EXISTS chk_planned_materials_coats_positive;
ALTER TABLE public.activity_planned_materials ADD CONSTRAINT chk_planned_materials_coats_positive
    CHECK (coats IS NULL OR coats > 0);

ALTER TABLE public.activity_planned_materials DROP CONSTRAINT IF EXISTS chk_planned_materials_packages_positive;
ALTER TABLE public.activity_planned_materials ADD CONSTRAINT chk_planned_materials_packages_positive
    CHECK (packages_required IS NULL OR packages_required >= 0);
