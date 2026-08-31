-- ==============================================================================
-- Migration: 20260825000016_permanent_activity_deletion.sql
-- Descrição: Implementa a exclusão definitiva, atômica e segura de Atividades
--            com limpeza em cascata de todas as dependências relacionadas e
--            protegida pela permissão 'atividades.excluir'.
--
-- Objetivos:
--   1. Cadastrar a permissão 'atividades.excluir' no catálogo public.permissions.
--   2. Conceder a permissão na matriz padrão para 'administrador' e 'desenvolvedor'.
--   3. Criar a RPC segura public.delete_activity_permanently com SECURITY DEFINER,
--      SET search_path = public, auth, pg_temp, validação estrita de permissão,
--      remoção atômica de fotos (activity_photos, activity_photo_records),
--      consumos (activity_consumptions), auditoria (activity_audit_logs),
--      notificações (public.notifications onde entity_id = activity_id),
--      tags (activity_tags), materiais planejados (activity_planned_materials)
--      e a atividade principal (public.activities), retornando a lista de
--      storage_paths das fotos para deleção no bucket Storage.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CATALOGAR PERMISSÃO: atividades.excluir
-- ------------------------------------------------------------------------------
INSERT INTO public.permissions (id, category, name, description)
VALUES (
    'atividades.excluir',
    'atividades',
    'Excluir Atividades Definitivamente',
    'Permite remover permanentemente ordens de serviço e todo seu histórico associado do banco de dados.'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. CONCEDER NA MATRIZ PADRÃO (Coordenadores, Administradores e Desenvolvedores)
-- ------------------------------------------------------------------------------
INSERT INTO public.role_base_permissions (role, permission_id)
VALUES
    ('coordenador', 'atividades.excluir'),
    ('administrador', 'atividades.excluir'),
    ('desenvolvedor', 'atividades.excluir')
ON CONFLICT (role, permission_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. RPC ATÔMICA: public.delete_activity_permanently
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_activity_permanently(
    p_activity_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_order_number VARCHAR(50);
    v_activity_name VARCHAR(255);
    v_photo_paths TEXT[];
BEGIN
    -- 1. Validar Autenticação
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: Usuário não autenticado.';
    END IF;

    -- 2. Validar Autorização via public.has_permission()
    IF NOT public.has_permission('atividades.excluir') THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui a permissão atividades.excluir para exclusão definitiva.';
    END IF;

    -- 3. Validar Parâmetro de Entrada
    IF p_activity_id IS NULL THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente: activity_id.';
    END IF;

    -- 4. Verificar existência e obter metadados da atividade
    SELECT order_number, name
    INTO v_order_number, v_activity_name
    FROM public.activities
    WHERE id = p_activity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Atividade não encontrada (ID: %).', p_activity_id;
    END IF;

    -- 5. Coletar caminhos das fotos físicas no Storage antes da deleção dos metadados
    SELECT ARRAY_AGG(ap.storage_path)
    INTO v_photo_paths
    FROM public.activity_photos ap
    JOIN public.activity_photo_records apr ON apr.id = ap.photo_record_id
    WHERE apr.activity_id = p_activity_id;

    -- 6. Deleção Atômica das Dependências em Ordem de Integridade

    -- 6.1. Metadados de Fotos
    DELETE FROM public.activity_photos
    WHERE photo_record_id IN (
        SELECT id FROM public.activity_photo_records WHERE activity_id = p_activity_id
    );

    DELETE FROM public.activity_photo_records
    WHERE activity_id = p_activity_id;

    -- 6.2. Notificações vinculadas à atividade (e leituras em cascata via FK)
    DELETE FROM public.notifications
    WHERE entity_type = 'activity' AND entity_id = p_activity_id;

    -- 6.3. Consumos Reais apontados na atividade
    DELETE FROM public.activity_consumptions
    WHERE activity_id = p_activity_id;

    -- 6.4. Histórico de Auditoria da atividade
    DELETE FROM public.activity_audit_logs
    WHERE activity_id = p_activity_id;

    -- 6.5. Tags e Materiais Planejados
    DELETE FROM public.activity_tags
    WHERE activity_id = p_activity_id;

    DELETE FROM public.activity_planned_materials
    WHERE activity_id = p_activity_id;

    -- 6.6. Registro Principal da Atividade
    DELETE FROM public.activities
    WHERE id = p_activity_id;

    -- 7. Retornar confirmação estruturada e lista de caminhos de arquivos para limpeza no Storage
    RETURN jsonb_build_object(
        'success', true,
        'activity_id', p_activity_id,
        'order_number', v_order_number,
        'name', v_activity_name,
        'deleted_photo_paths', COALESCE(v_photo_paths, ARRAY[]::TEXT[])
    );
END;
$$;

-- Permissão de Execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.delete_activity_permanently TO authenticated;
