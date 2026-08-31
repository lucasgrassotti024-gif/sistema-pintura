-- ==============================================================================
-- Migration: 20260823000006_activity_consumptions_and_audit_logs.sql
-- Descrição: Cria as tabelas para persistência de Consumo Real e Auditoria/Histórico
--            de Atividades de Pintura (public.activity_consumptions e public.activity_audit_logs).
-- Tabelas criadas:
--   1. public.activity_consumptions
--   2. public.activity_audit_logs
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA: public.activity_consumptions (Consumo Real Oficial de Insumos)
-- Suporta:
--   - Insumo do catálogo (material_id preenchido, custom_material_name NULL)
--   - Insumo livre "Outro" (material_id NULL, custom_material_name preenchido)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_consumptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE RESTRICT,
    custom_material_name VARCHAR(150),
    quantity NUMERIC(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    registered_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    observation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints de Integridade
    CONSTRAINT chk_consumption_quantity CHECK (quantity > 0),
    CONSTRAINT chk_consumption_unit CHECK (length(trim(unit)) > 0),
    -- Garante que exista material_id OU custom_material_name (nunca ambos vazios)
    CONSTRAINT chk_consumption_material_specified CHECK (
        (material_id IS NOT NULL) OR 
        (custom_material_name IS NOT NULL AND length(trim(custom_material_name)) > 0)
    )
);

-- ------------------------------------------------------------------------------
-- 2. TABELA: public.activity_audit_logs (Histórico de Alterações e Auditoria)
-- Suporta: criação, avanço físico, reprogramação, cancelamento, consumo e edição
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_name_cache VARCHAR(150),
    action VARCHAR(100) NOT NULL, -- Ex: 'Criação', 'Avanço de Progresso', 'Reprogramação', 'Cancelamento', 'Consumo Real'
    field VARCHAR(100),           -- Ex: 'Status', 'Progresso', 'Datas', 'Revisão Geral'
    old_value TEXT,
    new_value TEXT,
    old_progress INTEGER,
    new_progress INTEGER,
    consumed_materials_json JSONB, -- Cache estruturado dos insumos consumidos no apontamento
    observation TEXT,              -- Justificativa / Motivo / Observação
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints de Integridade
    CONSTRAINT chk_audit_progress_range CHECK (
        (old_progress IS NULL OR (old_progress >= 0 AND old_progress <= 100)) AND
        (new_progress IS NULL OR (new_progress >= 0 AND new_progress <= 100))
    )
);

-- ------------------------------------------------------------------------------
-- 3. ÍNDICES DE ALTA PERFORMANCE
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_activity_consumptions_activity_id ON public.activity_consumptions(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_consumptions_material_id ON public.activity_consumptions(material_id);
CREATE INDEX IF NOT EXISTS idx_activity_consumptions_created_at ON public.activity_consumptions(created_at);

CREATE INDEX IF NOT EXISTS idx_activity_audit_logs_activity_id ON public.activity_audit_logs(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_audit_logs_user_id ON public.activity_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_audit_logs_created_at ON public.activity_audit_logs(created_at DESC);
