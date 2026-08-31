-- ==============================================================================
-- Migration: 20260823000001_initial_schema.sql
-- Descrição: Fundação inicial do banco de dados relacional para o Sistema de Pintura
-- Documento de referência: docs/database/data-model-proposal.md
-- Tabelas criadas:
--   1. users
--   2. areas
--   3. locations
--   4. equipments
--   5. teams
--   6. materials
--   7. activities
--   8. activity_tags
--   9. activity_planned_materials
-- ==============================================================================

-- Extensão para geração de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. USERS (Usuários, Operadores e Coordenadores)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'operador',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_user_role CHECK (role IN ('coordenador', 'inspetor', 'operador', 'administrador'))
);

-- ------------------------------------------------------------------------------
-- 2. AREAS (Áreas Operacionais)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. LOCATIONS (Locais de Aplicação)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_location_area_name UNIQUE (area_id, name)
);

-- ------------------------------------------------------------------------------
-- 4. EQUIPMENTS (Equipamentos e Estruturas Físicas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. TEAMS (Equipes de Execução)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    leader_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 6. MATERIALS (Catálogo de Materiais e Insumos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100),
    color VARCHAR(100),
    unit VARCHAR(20) NOT NULL,
    current_stock NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    minimum_stock NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    location VARCHAR(150),
    batch VARCHAR(50),
    expiration_date DATE,
    technical_info TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_material_current_stock CHECK (current_stock >= 0.00),
    CONSTRAINT chk_material_minimum_stock CHECK (minimum_stock >= 0.00)
);

-- ------------------------------------------------------------------------------
-- 7. ACTIVITIES (Ordens de Serviço e Atividades de Pintura)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    origin_reference VARCHAR(150),
    area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    equipment_id UUID REFERENCES public.equipments(id) ON DELETE SET NULL,
    custom_location_text VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'programada',
    priority VARCHAR(20) NOT NULL DEFAULT 'media',
    progress_percentage INTEGER NOT NULL DEFAULT 0,
    assigned_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    service_quantity NUMERIC(10,2),
    service_unit VARCHAR(20) DEFAULT 'm²',
    planned_start_date DATE NOT NULL,
    planned_end_date DATE NOT NULL,
    actual_start_date DATE,
    actual_end_date DATE,
    observations TEXT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints de Integridade Operacional
    CONSTRAINT uq_activity_order_number UNIQUE (order_number),
    CONSTRAINT chk_activity_status CHECK (status IN ('programada', 'em_andamento', 'pausada', 'concluida', 'cancelada')),
    CONSTRAINT chk_activity_priority CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
    CONSTRAINT chk_activity_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    CONSTRAINT chk_activity_dates CHECK (planned_start_date <= planned_end_date),
    CONSTRAINT chk_activity_cancellation CHECK (
        (status = 'cancelada' AND cancellation_reason IS NOT NULL AND cancelled_at IS NOT NULL) OR
        (status <> 'cancelada')
    )
);

-- ------------------------------------------------------------------------------
-- 8. ACTIVITY_TAGS (Identificadores de Campo / Tags)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    tag_code VARCHAR(50) NOT NULL,
    is_main BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_activity_tag UNIQUE (activity_id, tag_code)
);

-- ------------------------------------------------------------------------------
-- 9. ACTIVITY_PLANNED_MATERIALS (Materiais Planejados / Demanda Estimada)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_planned_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
    custom_material_name VARCHAR(150) NOT NULL,
    planned_quantity NUMERIC(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_planned_quantity CHECK (planned_quantity > 0)
);

-- ==============================================================================
-- ÍNDICES DE ALTA PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_locations_area_id ON public.locations(area_id);
CREATE INDEX IF NOT EXISTS idx_equipments_location_id ON public.equipments(location_id);
CREATE INDEX IF NOT EXISTS idx_materials_active ON public.materials(active);
CREATE INDEX IF NOT EXISTS idx_materials_code ON public.materials(code);

CREATE INDEX IF NOT EXISTS idx_activities_order_number ON public.activities(order_number);
CREATE INDEX IF NOT EXISTS idx_activities_status ON public.activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_schedule ON public.activities(planned_start_date, planned_end_date);
CREATE INDEX IF NOT EXISTS idx_activities_area_id ON public.activities(area_id);
CREATE INDEX IF NOT EXISTS idx_activities_location_id ON public.activities(location_id);
CREATE INDEX IF NOT EXISTS idx_activities_team_id ON public.activities(team_id);
CREATE INDEX IF NOT EXISTS idx_activities_assigned_user_id ON public.activities(assigned_user_id);

CREATE INDEX IF NOT EXISTS idx_activity_tags_activity_id ON public.activity_tags(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_tags_code ON public.activity_tags(tag_code);

CREATE INDEX IF NOT EXISTS idx_planned_materials_activity_id ON public.activity_planned_materials(activity_id);
CREATE INDEX IF NOT EXISTS idx_planned_materials_material_id ON public.activity_planned_materials(material_id);
