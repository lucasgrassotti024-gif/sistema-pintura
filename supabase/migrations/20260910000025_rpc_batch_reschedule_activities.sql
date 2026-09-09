-- ==============================================================================
-- Migration: 20260910000025_rpc_batch_reschedule_activities.sql
-- Descrição: Cria a função RPC transacional `batch_reschedule_activities` para
--            reprogramação atômica em lote de atividades de pintura no Planner Operacional.
--
-- Regras Arquiteturais e de Segurança:
--   1. Transação Única e Atômica (PostgreSQL plpgsql): se qualquer validação ou
--      atualização falhar, toda a transação sofre ROLLBACK automático.
--   2. Autorização: Exige estritamente a permissão `atividades.reprogramar`.
--   3. Auditoria Imutável: Para cada atividade reprogramada, insere um registro
--      em `public.activity_audit_logs` registrando as datas anteriores, as novas datas
--      e a justificativa informada.
--   4. Preservação de Integridade: Impede reprogramação de atividades concluídas ou canceladas.
--   5. GRANT EXECUTE concedido estritamente para a role 'authenticated'.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.batch_reschedule_activities(
    p_changes JSONB,
    p_justification TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_now TIMESTAMPTZ := now();
    v_item RECORD;
    v_activity_id UUID;
    v_new_start DATE;
    v_new_end DATE;
    v_curr_status VARCHAR(30);
    v_curr_start DATE;
    v_curr_end DATE;
    v_order_number VARCHAR(50);
    v_count INTEGER := 0;
    v_obs TEXT;
BEGIN
    -- 1. Validar autenticação do usuário
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não autorizada: Usuário não autenticado.';
    END IF;

    -- 2. Validar permissão estrita no catálogo híbrido de autorização
    IF NOT public.has_permission('atividades.reprogramar') THEN
        RAISE EXCEPTION 'Permissão negada: O usuário não possui autorização para reprogramar atividades (atividades.reprogramar).';
    END IF;

    -- 3. Validar payload de alterações
    IF p_changes IS NULL OR jsonb_array_length(p_changes) = 0 THEN
        RAISE EXCEPTION 'Nenhuma alteração foi informada para processamento.';
    END IF;

    v_obs := COALESCE(NULLIF(TRIM(p_justification), ''), 'Ajuste de cronograma via Planner Operacional');

    -- 4. Iterar sobre cada item do lote dentro da mesma transação
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_changes) AS x(
        activity_id UUID,
        new_start_date DATE,
        new_end_date DATE
    )
    LOOP
        v_activity_id := v_item.activity_id;
        v_new_start := v_item.new_start_date;
        v_new_end := v_item.new_end_date;

        IF v_activity_id IS NULL OR v_new_start IS NULL OR v_new_end IS NULL THEN
            RAISE EXCEPTION 'Dados de reprogramação inválidos: ID da atividade ou datas ausentes.';
        END IF;

        IF v_new_start > v_new_end THEN
            RAISE EXCEPTION 'Inconsistência cronológica: A data de início (%) não pode ser posterior à data de término (%).', v_new_start, v_new_end;
        END IF;

        -- Buscar dados atuais da atividade com lock de linha (FOR UPDATE) para garantir concorrência segura
        SELECT status, planned_start_date, planned_end_date, order_number
        INTO v_curr_status, v_curr_start, v_curr_end, v_order_number
        FROM public.activities
        WHERE id = v_activity_id AND archived_at IS NULL
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Atividade não encontrada ou arquivada: %', v_activity_id;
        END IF;

        IF v_curr_status = 'concluida' THEN
            RAISE EXCEPTION 'Não é permitido reprogramar a OS % pois já se encontra CONCLUÍDA.', v_order_number;
        END IF;

        IF v_curr_status = 'cancelada' THEN
            RAISE EXCEPTION 'Não é permitido reprogramar a OS % pois a mesma foi CANCELADA.', v_order_number;
        END IF;

        -- Se as datas não mudaram, pula a gravação
        IF v_curr_start = v_new_start AND v_curr_end = v_new_end THEN
            CONTINUE;
        END IF;

        -- Atualizar as datas planejadas na atividade
        UPDATE public.activities
        SET 
            planned_start_date = v_new_start,
            planned_end_date = v_new_end,
            updated_at = v_now
        WHERE id = v_activity_id;

        -- Registrar histórico imutável em public.activity_audit_logs
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
            v_activity_id,
            v_user_id,
            'Reprogramação',
            'Datas Planejadas',
            to_char(v_curr_start, 'DD/MM/YYYY') || ' a ' || to_char(v_curr_end, 'DD/MM/YYYY'),
            to_char(v_new_start, 'DD/MM/YYYY') || ' a ' || to_char(v_new_end, 'DD/MM/YYYY'),
            v_obs,
            v_now
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'sucesso', true,
        'total_reprogramadas', v_count,
        'timestamp', v_now
    );
END;
$$;

-- Privilégios de execução
REVOKE ALL ON FUNCTION public.batch_reschedule_activities(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.batch_reschedule_activities(JSONB, TEXT) TO authenticated;
