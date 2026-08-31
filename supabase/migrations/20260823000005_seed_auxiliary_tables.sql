-- ==============================================================================
-- Migration: 20260823000005_seed_auxiliary_tables.sql
-- Descrição: Popula as tabelas auxiliares (areas, locations, equipments, teams)
--            com os dados extraídos estritamente dos presets e mocks de Atividades.
-- Estratégia: Utiliza CTEs (Common Table Expressions) e ON CONFLICT para garantir
--             idempotência e preservar chaves estrangeiras sem duplicação.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. POPULAR public.areas (Áreas Operacionais)
-- ------------------------------------------------------------------------------
INSERT INTO public.areas (name, code, active) VALUES
('Área Industrial Norte', 'AIN', true),
('Utilidades', 'UTI', true),
('Geração de Vapor', 'GVP', true),
('Logística', 'LOG', true),
('Área de Tanques', 'ATQ', true)
ON CONFLICT (name) DO UPDATE 
SET 
    code = EXCLUDED.code,
    active = EXCLUDED.active;

-- ------------------------------------------------------------------------------
-- 2. POPULAR public.locations (Locais de Aplicação vinculados às Áreas)
-- ------------------------------------------------------------------------------
WITH area_refs AS (
    SELECT id, name FROM public.areas
)
INSERT INTO public.locations (area_id, name)
SELECT a.id, loc.name
FROM (VALUES
    ('Área Industrial Norte', 'Pátio de Tanques'),
    ('Área Industrial Norte', 'Vias Internas'),
    ('Utilidades', 'Linha Principal de Incêndio'),
    ('Utilidades', 'Pipe Rack Principal'),
    ('Geração de Vapor', 'Casa de Caldeiras'),
    ('Logística', 'Galpão 4'),
    ('Área de Tanques', 'Pátio de Tanques')
) AS loc(area_name, name)
JOIN area_refs a ON a.name = loc.area_name
ON CONFLICT (area_id, name) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. POPULAR public.equipments (Equipamentos vinculados aos Locais)
-- ------------------------------------------------------------------------------
WITH loc_refs AS (
    SELECT l.id, l.name AS location_name, a.name AS area_name
    FROM public.locations l
    JOIN public.areas a ON a.id = l.area_id
)
INSERT INTO public.equipments (location_id, name)
SELECT l.id, eq.name
FROM (VALUES
    ('Área Industrial Norte', 'Pátio de Tanques', 'Tanque T-01'),
    ('Área Industrial Norte', 'Vias Internas', 'Piso Asfáltico / Concreto'),
    ('Utilidades', 'Linha Principal de Incêndio', 'Tubulação 6 pol'),
    ('Utilidades', 'Pipe Rack Principal', 'Escada Metálica'),
    ('Utilidades', 'Pipe Rack Principal', 'Estrutura de Suporte'),
    ('Geração de Vapor', 'Casa de Caldeiras', 'Caldeira B'),
    ('Logística', 'Galpão 4', 'Vigas I e Pilares'),
    ('Área de Tanques', 'Pátio de Tanques', 'Tanque T-01')
) AS eq(area_name, location_name, name)
JOIN loc_refs l ON l.area_name = eq.area_name AND l.location_name = eq.location_name
WHERE NOT EXISTS (
    SELECT 1 FROM public.equipments e 
    WHERE e.location_id = l.id AND e.name = eq.name
);

-- ------------------------------------------------------------------------------
-- 4. POPULAR public.teams (Equipes de Execução)
-- ------------------------------------------------------------------------------
INSERT INTO public.teams (name, active) VALUES
('Equipe Alfa - Pintura Pesada', true),
('Equipe Beta - Tubulações', true),
('Equipe Geral', true),
('Equipe de Manutenção Rápida', true)
ON CONFLICT (name) DO UPDATE 
SET active = EXCLUDED.active;
