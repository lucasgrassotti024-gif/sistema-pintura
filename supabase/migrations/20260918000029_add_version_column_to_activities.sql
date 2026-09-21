-- ==============================================================================
-- Migration: 20260918000029_add_version_column_to_activities.sql
-- Descrição: Adiciona a coluna version INTEGER NOT NULL DEFAULT 1 em public.activities
--            para suporte a Controle Otimista de Concorrência (OCC) no futuro Sync Engine.
--            Garante que todos os registros preexistentes recebam version = 1.
--            Não introduz triggers automáticos; a versão será incrementada
--            explicitamente pelas RPCs transacionais de mutação.
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'activities' 
          AND column_name = 'version'
    ) THEN
        -- 1. Adiciona coluna com DEFAULT 1 e NOT NULL
        ALTER TABLE public.activities 
        ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

        -- 2. Garantia explícita para quaisquer linhas preexistentes
        UPDATE public.activities 
        SET version = 1 
        WHERE version IS NULL;

        -- 3. Constraint defensiva para impedir versões regressivas ou inválidas
        ALTER TABLE public.activities
        DROP CONSTRAINT IF EXISTS chk_activity_version_positive;

        ALTER TABLE public.activities
        ADD CONSTRAINT chk_activity_version_positive CHECK (version >= 1);
    END IF;
END $$;
