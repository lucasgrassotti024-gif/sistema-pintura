-- ==============================================================================
-- Migration: 20260918000032_idempotent_cancel_activity.sql
-- Descrição: Evolui public.cancel_activity(p_activity_id, p_cancellation_reason, p_idempotency_key)
--            para comportamento idempotente explícito com retornos estruturados JSONB:
--            1. Remove a assinatura antiga de 2 parâmetros via DROP FUNCTION para evitar overload ambíguo no PostgreSQL.
--            2. Recria aceitando p_idempotency_key UUID DEFAULT NULL (preservando chamadas online legadas de 2 argumentos).
--            3. Não lança exceção textual se a atividade já estiver cancelada;
--               retorna sucesso idempotente estruturado {"success": true, "idempotent": true, "already_cancelled": true}.
--            4. Valida se a idempotency_key pertence à mesma atividade e à ação de cancelamento.
--            5. Incrementa a coluna version em public.activities para compatibilidade com OCC.
--            6. Registra a idempotency_key em public.activity_audit_logs na mesma transação.
-- ==============================================================================

-- 1. Elimina a assinatura de 2 parâmetros para prevenir colisão/ambiguidade de overload
DROP FUNCTION IF EXISTS public.cancel_activity(UUID, TEXT);

-- 2. Recria a função com o parâmetro opcional p_idempotency_key
CREATE OR REPLACE FUNCTION public.cancel_activity(
    p_activity_id UUID,
    p_cancellation_reason TEXT,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150) := 'Usuário Autenticado';
    v_current_status VARCHAR(30);
    v_current_version INTEGER;
    v_new_version INTEGER;
    v_order_number VARCHAR(50);
    v_existing_reason TEXT;
    v_existing_cancelled_at TIMESTAMPTZ;
    v_archived_at TIMESTAMPTZ;
    v_audit_activity_id UUID;
    v_audit_action VARCHAR(100);
    v_now TIMESTAMPTZ := now();
BEGIN
    -- 1. Validar Autenticação Estrita
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: Usuário não autenticado.';
    END IF;

    -- 2. Validar Autorização via Modelo Híbrido ('atividades.cancelar')
    IF NOT public.has_permission('atividades.cancelar') THEN
        RAISE EXCEPTION 'Permissão negada: o usuário não possui autorização para cancelar atividades (atividades.cancelar).';
    END IF;

    -- 3. Validar Parâmetros de Entrada
    IF p_activity_id IS NULL THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente: activity_id.';
    END IF;

    IF p_cancellation_reason IS NULL OR length(trim(p_cancellation_reason)) = 0 THEN
        RAISE EXCEPTION 'A justificativa de cancelamento é obrigatória.';
    END IF;

    -- 4. Bloqueio Concorrencial Transacional Exclusivo por Chave de Idempotência
    IF p_idempotency_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

        -- 5. Checagem de Idempotência com Validação Cruzada Estrita
        SELECT activity_id, action INTO v_audit_activity_id, v_audit_action
        FROM public.activity_audit_logs 
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            -- Validação Cruzada: Impede uso indevido de chave de outra atividade ou outra ação
            IF v_audit_activity_id <> p_activity_id OR v_audit_action <> 'Cancelamento da Atividade' THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'conflict', true,
                    'code', 'IDEMPOTENCY_KEY_COLLISION',
                    'activity_id', p_activity_id,
                    'audit_activity_id', v_audit_activity_id,
                    'message', 'A chave de idempotência informada já foi utilizada em outra atividade ou operação diferente.'
                );
            END IF;

            SELECT version, order_number, status, cancellation_reason, cancelled_at
            INTO v_current_version, v_order_number, v_current_status, v_existing_reason, v_existing_cancelled_at
            FROM public.activities 
            WHERE id = p_activity_id;

            IF FOUND THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'idempotent', true,
                    'already_cancelled', true,
                    'activity_id', p_activity_id,
                    'order_number', v_order_number,
                    'status', v_current_status,
                    'cancellation_reason', v_existing_reason,
                    'cancelled_at', v_existing_cancelled_at,
                    'server_version', v_current_version,
                    'message', 'Cancelamento já processado anteriormente por esta chave de idempotência.'
                );
            END IF;
        END IF;
    END IF;

    -- 6. Buscar e Bloquear a Linha da Atividade (FOR UPDATE)
    SELECT status, version, order_number, cancellation_reason, cancelled_at, archived_at
    INTO v_current_status, v_current_version, v_order_number, v_existing_reason, v_existing_cancelled_at, v_archived_at
    FROM public.activities
    WHERE id = p_activity_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Atividade não encontrada com o ID informado: %', p_activity_id;
    END IF;

    -- 7. Tratar Atividade Arquivada
    IF v_archived_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'code', 'ACTIVITY_ARCHIVED',
            'activity_id', p_activity_id,
            'order_number', v_order_number,
            'message', 'A atividade encontra-se arquivada e não pode ser cancelada.'
        );
    END IF;

    -- 8. Tratar Atividade já Concluída (Regra de Negócio Absoluta: Não permite cancelar concluída)
    IF v_current_status = 'concluida' THEN
        RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'code', 'CANNOT_CANCEL_COMPLETED',
            'activity_id', p_activity_id,
            'order_number', v_order_number,
            'message', 'Não é permitido cancelar uma atividade que já foi concluída.'
        );
    END IF;

    -- 9. IDEMPOTÊNCIA EXPLÍCITA: Se já se encontra cancelada, retornar sucesso idempotente sem estourar erro
    IF v_current_status = 'cancelada' THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'already_cancelled', true,
            'activity_id', p_activity_id,
            'order_number', v_order_number,
            'status', 'cancelada',
            'cancellation_reason', v_existing_reason,
            'cancelled_at', v_existing_cancelled_at,
            'server_version', v_current_version,
            'message', 'A atividade já se encontra cancelada no servidor.'
        );
    END IF;

    -- Resolver nome do usuário autenticado para log
    SELECT full_name INTO v_user_name
    FROM public.users
    WHERE id = v_user_id;

    v_new_version := COALESCE(v_current_version, 1) + 1;

    -- 10. Atualizar Status para 'cancelada' e incrementar version
    UPDATE public.activities
    SET 
        status = 'cancelada',
        cancellation_reason = trim(p_cancellation_reason),
        cancelled_at = v_now,
        cancelled_by_user_id = v_user_id,
        version = v_new_version,
        updated_at = v_now
    WHERE id = p_activity_id;

    -- 11. Registrar Evento no Log Oficial de Auditoria com idempotency_key na MESMA transação
    INSERT INTO public.activity_audit_logs (
        activity_id,
        user_id,
        user_name_cache,
        action,
        field,
        old_value,
        new_value,
        observation,
        idempotency_key,
        created_at
    ) VALUES (
        p_activity_id,
        v_user_id,
        COALESCE(v_user_name, 'Usuário Autenticado'),
        'Cancelamento da Atividade',
        'Status',
        upper(v_current_status),
        'CANCELADA',
        trim(p_cancellation_reason),
        p_idempotency_key,
        v_now
    );

    -- 12. Retorno Estruturado Conforme Contrato do Sync Engine
    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'activity_id', p_activity_id,
        'order_number', v_order_number,
        'status', 'cancelada',
        'cancellation_reason', trim(p_cancellation_reason),
        'cancelled_at', v_now,
        'server_version', v_new_version,
        'updated_at', v_now
    );
END;
$$;

-- Privilégios de Execução
REVOKE ALL ON FUNCTION public.cancel_activity(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_activity(UUID, TEXT, UUID) TO authenticated;
