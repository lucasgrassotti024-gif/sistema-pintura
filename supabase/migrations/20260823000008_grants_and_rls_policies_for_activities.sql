-- ==============================================================================
-- Migration: 20260823000008_grants_and_rls_policies_for_activities.sql
-- Descrição: Configura os GRANTs mínimos essenciais e as políticas RLS granulares
--            para o fluxo completo de perfil, leitura e criação de Atividades
--            para usuários autenticados, com base na função public.has_permission().
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PRIVILÉGIOS NO SCHEMA
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. HABILITAR RLS EM TODAS AS TABELAS ENVOLVIDAS
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_base_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_custom_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_planned_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_consumptions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. CONCESSÃO DE PRIVILÉGIOS (GRANTS) - PRINCÍPIO DO MENOR PRIVILÉGIO
-- ------------------------------------------------------------------------------

-- Privilégios de Leitura (SELECT)
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_base_permissions TO authenticated;
GRANT SELECT ON public.user_custom_permissions TO authenticated;
GRANT SELECT ON public.areas TO authenticated;
GRANT SELECT ON public.locations TO authenticated;
GRANT SELECT ON public.equipments TO authenticated;
GRANT SELECT ON public.teams TO authenticated;
GRANT SELECT ON public.materials TO authenticated;
GRANT SELECT ON public.activities TO authenticated;
GRANT SELECT ON public.activity_tags TO authenticated;
GRANT SELECT ON public.activity_planned_materials TO authenticated;
GRANT SELECT ON public.activity_audit_logs TO authenticated;
GRANT SELECT ON public.activity_consumptions TO authenticated;

-- Privilégios de Inserção (INSERT)
GRANT INSERT ON public.activities TO authenticated;
GRANT INSERT ON public.areas TO authenticated;
GRANT INSERT ON public.locations TO authenticated;
GRANT INSERT ON public.equipments TO authenticated;
GRANT INSERT ON public.activity_tags TO authenticated;
GRANT INSERT ON public.activity_planned_materials TO authenticated;
GRANT INSERT ON public.activity_audit_logs TO authenticated;
GRANT INSERT ON public.activity_consumptions TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS DE LINHA (RLS POLICIES) - IDEMPOTENTES
-- ------------------------------------------------------------------------------

-- 4.1. public.users
DROP POLICY IF EXISTS "policy_users_select_own" ON public.users;
CREATE POLICY "policy_users_select_own"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 4.2. public.permissions
DROP POLICY IF EXISTS "policy_permissions_select_auth" ON public.permissions;
CREATE POLICY "policy_permissions_select_auth"
ON public.permissions
FOR SELECT
TO authenticated
USING (true);

-- 4.3. public.role_base_permissions
DROP POLICY IF EXISTS "policy_role_base_permissions_select_auth" ON public.role_base_permissions;
CREATE POLICY "policy_role_base_permissions_select_auth"
ON public.role_base_permissions
FOR SELECT
TO authenticated
USING (true);

-- 4.4. public.user_custom_permissions
DROP POLICY IF EXISTS "policy_user_custom_permissions_select_own" ON public.user_custom_permissions;
CREATE POLICY "policy_user_custom_permissions_select_own"
ON public.user_custom_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 4.5. public.activities
DROP POLICY IF EXISTS "policy_activities_select_authorized" ON public.activities;
CREATE POLICY "policy_activities_select_authorized"
ON public.activities
FOR SELECT
TO authenticated
USING (public.has_permission('atividades.visualizar'));

DROP POLICY IF EXISTS "policy_activities_insert_authorized" ON public.activities;
CREATE POLICY "policy_activities_insert_authorized"
ON public.activities
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission('atividades.criar'));

-- 4.6. public.areas
DROP POLICY IF EXISTS "policy_areas_select_auth" ON public.areas;
CREATE POLICY "policy_areas_select_auth"
ON public.areas
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "policy_areas_insert_authorized" ON public.areas;
CREATE POLICY "policy_areas_insert_authorized"
ON public.areas
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission('atividades.criar'));

-- 4.7. public.locations
DROP POLICY IF EXISTS "policy_locations_select_auth" ON public.locations;
CREATE POLICY "policy_locations_select_auth"
ON public.locations
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "policy_locations_insert_authorized" ON public.locations;
CREATE POLICY "policy_locations_insert_authorized"
ON public.locations
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission('atividades.criar'));

-- 4.8. public.equipments
DROP POLICY IF EXISTS "policy_equipments_select_auth" ON public.equipments;
CREATE POLICY "policy_equipments_select_auth"
ON public.equipments
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "policy_equipments_insert_authorized" ON public.equipments;
CREATE POLICY "policy_equipments_insert_authorized"
ON public.equipments
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission('atividades.criar'));

-- 4.9. public.teams
DROP POLICY IF EXISTS "policy_teams_select_auth" ON public.teams;
CREATE POLICY "policy_teams_select_auth"
ON public.teams
FOR SELECT
TO authenticated
USING (true);

-- 4.10. public.materials
DROP POLICY IF EXISTS "policy_materials_select_auth" ON public.materials;
CREATE POLICY "policy_materials_select_auth"
ON public.materials
FOR SELECT
TO authenticated
USING (true);

-- 4.11. public.activity_tags
DROP POLICY IF EXISTS "policy_activity_tags_select_authorized" ON public.activity_tags;
CREATE POLICY "policy_activity_tags_select_authorized"
ON public.activity_tags
FOR SELECT
TO authenticated
USING (public.has_permission('atividades.visualizar'));

DROP POLICY IF EXISTS "policy_activity_tags_insert_authorized" ON public.activity_tags;
CREATE POLICY "policy_activity_tags_insert_authorized"
ON public.activity_tags
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission('atividades.criar'));

-- 4.12. public.activity_planned_materials
DROP POLICY IF EXISTS "policy_activity_planned_materials_select_authorized" ON public.activity_planned_materials;
CREATE POLICY "policy_activity_planned_materials_select_authorized"
ON public.activity_planned_materials
FOR SELECT
TO authenticated
USING (public.has_permission('atividades.visualizar'));

DROP POLICY IF EXISTS "policy_activity_planned_materials_insert_authorized" ON public.activity_planned_materials;
CREATE POLICY "policy_activity_planned_materials_insert_authorized"
ON public.activity_planned_materials
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission('atividades.criar'));

-- 4.13. public.activity_audit_logs
DROP POLICY IF EXISTS "policy_activity_audit_logs_select_authorized" ON public.activity_audit_logs;
CREATE POLICY "policy_activity_audit_logs_select_authorized"
ON public.activity_audit_logs
FOR SELECT
TO authenticated
USING (public.has_permission('atividades.visualizar'));

DROP POLICY IF EXISTS "policy_activity_audit_logs_insert_authorized" ON public.activity_audit_logs;
CREATE POLICY "policy_activity_audit_logs_insert_authorized"
ON public.activity_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4.14. public.activity_consumptions
DROP POLICY IF EXISTS "policy_activity_consumptions_select_authorized" ON public.activity_consumptions;
CREATE POLICY "policy_activity_consumptions_select_authorized"
ON public.activity_consumptions
FOR SELECT
TO authenticated
USING (public.has_permission('atividades.visualizar'));

DROP POLICY IF EXISTS "policy_activity_consumptions_insert_authorized" ON public.activity_consumptions;
CREATE POLICY "policy_activity_consumptions_insert_authorized"
ON public.activity_consumptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = registered_by_user_id);
