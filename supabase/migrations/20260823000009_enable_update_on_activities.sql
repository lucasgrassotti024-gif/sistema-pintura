-- ==============================================================================
-- Migration: 20260823000009_enable_update_on_activities.sql
-- Descrição: Concede o privilégio de UPDATE em public.activities para a role
--            authenticated e cria a política RLS 'policy_activities_update_authorized'
--            utilizando a função nativa public.has_permission('atividades.editar').
-- ==============================================================================

-- 1. Conceder privilégio de UPDATE em public.activities para usuários autenticados
GRANT UPDATE ON public.activities TO authenticated;

-- 2. Criar política RLS de UPDATE protegida por permissão granular
DROP POLICY IF EXISTS "policy_activities_update_authorized" ON public.activities;

CREATE POLICY "policy_activities_update_authorized"
ON public.activities
FOR UPDATE
TO authenticated
USING (public.has_permission('atividades.editar'))
WITH CHECK (public.has_permission('atividades.editar'));
