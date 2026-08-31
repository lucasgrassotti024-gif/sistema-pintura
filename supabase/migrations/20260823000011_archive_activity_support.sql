-- ==============================================================================
-- Migration: 20260823000011_archive_activity_support.sql
-- Descrição: Adiciona a permissão 'atividades.arquivar' com as colunas reais do schema
--            (id, category, name, description), colunas de soft delete em public.activities
--            e a RPC transacional public.archive_activity(UUID, TEXT) com SECURITY DEFINER.
-- ==============================================================================

-- 1. Inserir a nova permissão no catálogo public.permissions respeitando o schema real
INSERT INTO public.permissions (id, category, name, description)
VALUES (
    'atividades.arquivar', 
    'atividades', 
    'Arquivar Atividades', 
    'Permite arquivar ordens de serviço e atividades operacionais'
)
ON CONFLICT (id) DO UPDATE 
SET 
    category = EXCLUDED.category,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 2. Conceder a nova permissão exclusivamente aos cargos coordenador, administrador e desenvolvedor
INSERT INTO public.role_base_permissions (role, permission_id)
VALUES 
    ('coordenador', 'atividades.arquivar'),
    ('administrador', 'atividades.arquivar'),
    ('desenvolvedor', 'atividades.arquivar')
ON CONFLICT (role, permission_id) DO NOTHING;

-- 3. Adicionar colunas de arquivamento em public.activities
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS archive_reason TEXT;

-- 4. Criar índice para performance nas consultas filtradas
CREATE INDEX IF NOT EXISTS idx_activities_archived_at ON public.activities(archived_at);

-- 5. Criar a função RPC de arquivamento seguro com SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.archive_activity(
    p_activity_id UUID,
    p_archive_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_now TIMESTAMPTZ := now();
    v_current_status VARCHAR(30);
    v_already_archived TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    -- 1. Validar autenticação
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- 2. Obter nome para cache de auditoria
    SELECT full_name INTO v_user_name
    FROM public.users
    WHERE id = v_user_id;

    -- 3. Validar permissão específica
    IF NOT public.has_permission('atividades.arquivar') THEN
        RAISE EXCEPTION 'Permissão negada: o usuário não possui a permissão atividades.arquivar.';
    END IF;

    -- 4. Verificar existência e se já está arquivada
    SELECT status, archived_at INTO v_current_status, v_already_archived
    FROM public.activities
    WHERE id = p_activity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Atividade não encontrada com o ID informado: %', p_activity_id;
    END IF;

    IF v_already_archived IS NOT NULL THEN
        RAISE EXCEPTION 'Esta atividade já se encontra arquivada.';
    END IF;

    -- 5. Executar arquivamento na atividade (preservando o status operacional original)
    UPDATE public.activities
    SET 
        archived_at = v_now,
        archived_by_user_id = v_user_id,
        archive_reason = CASE 
            WHEN p_archive_reason IS NOT NULL AND length(trim(p_archive_reason)) > 0 
            THEN trim(p_archive_reason) 
            ELSE NULL 
        END,
        updated_at = v_now
    WHERE id = p_activity_id;

    -- 6. Registrar evento no log de auditoria respeitando o schema real de public.activity_audit_logs
    INSERT INTO public.activity_audit_logs (
        activity_id,
        user_id,
        user_name_cache,
        action,
        field,
        old_value,
        new_value,
        observation,
        created_at
    ) VALUES (
        p_activity_id,
        v_user_id,
        COALESCE(v_user_name, 'Usuário Autenticado'),
        'Arquivamento da Atividade',
        'Status de Exibição',
        'ATIVA',
        'ARQUIVADA',
        COALESCE(trim(p_archive_reason), 'Atividade arquivada sem observação adicional'),
        v_now
    );

    SELECT jsonb_build_object(
        'id', p_activity_id,
        'archived_at', v_now,
        'archived_by_user_id', v_user_id,
        'updated_at', v_now
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 7. Conceder permissão de execução da RPC para authenticated
REVOKE ALL ON FUNCTION public.archive_activity(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_activity(UUID, TEXT) TO authenticated;
