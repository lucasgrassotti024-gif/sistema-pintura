-- ==============================================================================
-- Migration: 20260823000010_rpc_cancel_activity.sql
-- Descrição: Cria a função RPC transacional public.cancel_activity(UUID, TEXT)
--            com SECURITY DEFINER, search_path seguro e verificação estrita de
--            public.has_permission('atividades.cancelar').
--            Mantém a policy direta de UPDATE da tabela public.activities
--            restrita exclusivamente a public.has_permission('atividades.editar').
-- ==============================================================================

-- 1. Manter a policy de UPDATE direto da tabela restrita exclusivamente à permissão 'atividades.editar'
DROP POLICY IF EXISTS "policy_activities_update_authorized" ON public.activities;

CREATE POLICY "policy_activities_update_authorized"
ON public.activities
FOR UPDATE
TO authenticated
USING (public.has_permission('atividades.editar'))
WITH CHECK (public.has_permission('atividades.editar'));

-- 2. Criar a função RPC de cancelamento seguro com SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.cancel_activity(
    p_activity_id UUID,
    p_cancellation_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_current_status VARCHAR(30);
    v_now TIMESTAMPTZ := now();
    v_result JSONB;
BEGIN
    -- Obter o ID do usuário autenticado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Validar se o usuário possui a permissão específica 'atividades.cancelar'
    IF NOT public.has_permission('atividades.cancelar') THEN
        RAISE EXCEPTION 'Permissão negada: o usuário não possui autorização para cancelar atividades (atividades.cancelar).';
    END IF;

    -- Validar se a justificativa foi preenchida
    IF p_cancellation_reason IS NULL OR length(trim(p_cancellation_reason)) = 0 THEN
        RAISE EXCEPTION 'A justificativa de cancelamento é obrigatória.';
    END IF;

    -- Verificar existência e status atual da atividade
    SELECT status INTO v_current_status
    FROM public.activities
    WHERE id = p_activity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Atividade não encontrada com o ID informado: %', p_activity_id;
    END IF;

    IF v_current_status = 'concluida' THEN
        RAISE EXCEPTION 'Não é permitido cancelar uma atividade que já foi concluída.';
    END IF;

    IF v_current_status = 'cancelada' THEN
        RAISE EXCEPTION 'Esta atividade já se encontra cancelada.';
    END IF;

    -- Atualizar SOMENTE os campos de cancelamento (imutabilidade das demais colunas garantida)
    UPDATE public.activities
    SET 
        status = 'cancelada',
        cancellation_reason = trim(p_cancellation_reason),
        cancelled_at = v_now,
        cancelled_by_user_id = v_user_id,
        updated_at = v_now
    WHERE id = p_activity_id;

    -- Registrar evento no log de auditoria
    INSERT INTO public.activity_audit_logs (
        activity_id,
        user_id,
        action,
        field,
        old_value,
        new_value,
        observation,
        created_at
    ) VALUES (
        p_activity_id,
        v_user_id,
        'Cancelamento da Atividade',
        'Status',
        upper(v_current_status),
        'CANCELADA',
        trim(p_cancellation_reason),
        v_now
    );

    SELECT jsonb_build_object(
        'id', p_activity_id,
        'status', 'cancelada',
        'cancellation_reason', trim(p_cancellation_reason),
        'cancelled_at', v_now,
        'cancelled_by_user_id', v_user_id,
        'updated_at', v_now
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 3. Conceder permissão de execução da RPC exclusivamente para a role authenticated
REVOKE ALL ON FUNCTION public.cancel_activity(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_activity(UUID, TEXT) TO authenticated;
