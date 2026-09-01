-- ==============================================================================
-- Migration: 20260901000022_activity_consumption_stock_sync.sql
-- Descrição: Habilita saídas por consumo de atividade em stock_movements com
--            rastreabilidade, proteção concorrencial estrita via pg_advisory_xact_lock
--            e cria a RPC atômica public.update_activity_progress_and_consumption.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENDER TABELA public.stock_movements COM RASTREABILIDADE E UNICIDADE
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    -- Adicionar coluna activity_id (se não existir)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'activity_id'
    ) THEN
        ALTER TABLE public.stock_movements 
        ADD COLUMN activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL;
    END IF;

    -- Adicionar coluna consumption_id (se não existir)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'consumption_id'
    ) THEN
        ALTER TABLE public.stock_movements 
        ADD COLUMN consumption_id UUID REFERENCES public.activity_consumptions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Atualizar constraint de tipos de movimentação permitidos
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movement_type;
ALTER TABLE public.stock_movements ADD CONSTRAINT chk_stock_movement_type 
    CHECK (movement_type IN ('entrada', 'saida_atividade', 'ajuste'));

-- 1ª Camada de Proteção: Garantir que cada consumption_id só gere no máximo 1 saída física
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS uq_stock_movement_consumption;
ALTER TABLE public.stock_movements ADD CONSTRAINT uq_stock_movement_consumption 
    UNIQUE (consumption_id);

-- Índices de performance para consultas de histórico e auditoria
CREATE INDEX IF NOT EXISTS idx_stock_movements_activity_id ON public.stock_movements(activity_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_consumption_id ON public.stock_movements(consumption_id);

-- ------------------------------------------------------------------------------
-- 2. EXTENDER TABELA public.activity_audit_logs COM IDEMPOTENCY_KEY
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'activity_audit_logs' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.activity_audit_logs 
        ADD COLUMN idempotency_key UUID;
    END IF;
END $$;

-- 2ª Camada de Proteção: Unicidade global da chave de idempotência no log de auditoria
ALTER TABLE public.activity_audit_logs DROP CONSTRAINT IF EXISTS uq_activity_audit_logs_idempotency_key;
ALTER TABLE public.activity_audit_logs ADD CONSTRAINT uq_activity_audit_logs_idempotency_key 
    UNIQUE (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_activity_audit_logs_idempotency_key 
    ON public.activity_audit_logs(idempotency_key);

-- ------------------------------------------------------------------------------
-- 3. RPC ATÔMICA IDEMPOTENTE: public.update_activity_progress_and_consumption
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_activity_progress_and_consumption(
    p_activity_id UUID,
    p_new_progress INTEGER,
    p_consumptions JSONB DEFAULT '[]'::jsonb,
    p_observation TEXT DEFAULT NULL,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150) := 'Operador de Pintura';
    v_current_progress INTEGER;
    v_current_status VARCHAR(30);
    v_calculated_status VARCHAR(30);
    v_order_number VARCHAR(50);
    v_now TIMESTAMPTZ := now();
    
    -- Variáveis de iteração de consumo
    v_item JSONB;
    v_mat_id UUID;
    v_custom_name VARCHAR(150);
    v_qty NUMERIC(10,2);
    v_unit VARCHAR(20);
    v_consumption_id UUID;
    
    -- Variáveis de controle de estoque do material
    v_current_stock NUMERIC(12,2);
    v_new_stock NUMERIC(12,2);
    v_mat_name VARCHAR(150);
    v_mat_code VARCHAR(50);
BEGIN
    -- 1. Validação de Autenticação
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: Usuário não autenticado.';
    END IF;

    -- 2. Validação de Autorização via has_permission
    IF NOT public.has_permission('atividades.atualizar_progresso') THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui a permissão atividades.atualizar_progresso.';
    END IF;

    -- 3. Validação Obrigatória da Idempotency Key
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key é obrigatória.';
    END IF;

    -- 4. Bloqueio Concorrencial Transacional Exclusivo por Chave de Idempotência
    -- Garante que duas transações simultâneas para a mesma chave sejam serializadas
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

    -- 5. Checagem de Idempotência (Se a chave já foi processada, retornar imediatamente)
    IF EXISTS (SELECT 1 FROM public.activity_audit_logs WHERE idempotency_key = p_idempotency_key) THEN
        SELECT progress_percentage, status, order_number 
        INTO v_current_progress, v_current_status, v_order_number
        FROM public.activities 
        WHERE id = p_activity_id;

        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'activity_id', p_activity_id,
            'order_number', v_order_number,
            'progress', v_current_progress,
            'status', v_current_status,
            'message', 'Operação já processada anteriormente.'
        );
    END IF;

    -- Obter nome do usuário autenticado para cache de auditoria
    SELECT full_name INTO v_user_name
    FROM public.users
    WHERE id = v_user_id;

    -- 6. Validar Parâmetros da Atividade
    IF p_activity_id IS NULL THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente: activity_id.';
    END IF;

    IF p_new_progress IS NULL OR p_new_progress < 0 OR p_new_progress > 100 THEN
        RAISE EXCEPTION 'Progresso inválido: deve estar entre 0%% e 100%%.';
    END IF;

    -- 7. Buscar e Bloquear a Atividade (FOR UPDATE)
    SELECT progress_percentage, status, order_number
    INTO v_current_progress, v_current_status, v_order_number
    FROM public.activities
    WHERE id = p_activity_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Atividade não encontrada (ID: %).', p_activity_id;
    END IF;

    IF v_current_status = 'cancelada' THEN
        RAISE EXCEPTION 'Não é permitido atualizar o progresso de uma atividade cancelada.';
    END IF;

    IF p_new_progress < v_current_progress THEN
        RAISE EXCEPTION 'Regra de negócio: O novo progresso (%s%%) não pode ser inferior ao progresso anterior (%s%%).',
            p_new_progress, v_current_progress;
    END IF;

    -- 8. Determinar novo status operacional
    IF p_new_progress = 0 THEN
        v_calculated_status := 'programada';
    ELSIF p_new_progress >= 100 THEN
        v_calculated_status := 'concluida';
    ELSE
        v_calculated_status := 'em_andamento';
    END IF;

    -- 9. Atualizar a Atividade em public.activities
    UPDATE public.activities
    SET 
        progress_percentage = p_new_progress,
        status = v_calculated_status,
        actual_start_date = COALESCE(actual_start_date, CASE WHEN p_new_progress > 0 THEN v_now::date ELSE NULL END),
        actual_end_date = CASE WHEN p_new_progress >= 100 THEN v_now::date ELSE actual_end_date END,
        updated_at = v_now
    WHERE id = p_activity_id;

    -- 10. Processar Consumos Reais (se houverem)
    IF p_consumptions IS NOT NULL AND jsonb_array_length(p_consumptions) > 0 THEN
        IF NOT public.has_permission('atividades.registrar_consumo') THEN
            RAISE EXCEPTION 'Acesso negado: Você não possui a permissão atividades.registrar_consumo para apontar materiais.';
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_consumptions)
        LOOP
            v_mat_id := NULLIF(TRIM(v_item->>'material_id'), '')::UUID;
            v_custom_name := NULLIF(TRIM(v_item->>'custom_material_name'), '');
            v_qty := ROUND((v_item->>'quantity')::NUMERIC, 2);
            v_unit := TRIM(v_item->>'unit');

            IF v_qty IS NULL OR v_qty <= 0.00 THEN
                RAISE EXCEPTION 'Quantidade de consumo inválida para o material "%". O valor deve ser estritamente maior que zero.', 
                    COALESCE(v_custom_name, 'Insumo');
            END IF;

            IF v_unit IS NULL OR length(v_unit) = 0 THEN
                v_unit := 'L';
            END IF;

            -- Resolução por nome no catálogo (fallback se material_id não foi passado explicitamente)
            IF v_mat_id IS NULL AND v_custom_name IS NOT NULL THEN
                SELECT id INTO v_mat_id
                FROM public.materials
                WHERE lower(trim(name)) = lower(trim(v_custom_name)) AND active = true
                LIMIT 1;
            END IF;

            -- A. Inserir em public.activity_consumptions
            INSERT INTO public.activity_consumptions (
                activity_id,
                material_id,
                custom_material_name,
                quantity,
                unit,
                registered_by_user_id,
                observation,
                created_at
            ) VALUES (
                p_activity_id,
                v_mat_id,
                v_custom_name,
                v_qty,
                v_unit,
                v_user_id,
                NULLIF(TRIM(p_observation), ''),
                v_now
            )
            RETURNING id INTO v_consumption_id;

            -- B. Se o material pertence ao catálogo oficial, executar baixa física estrita
            IF v_mat_id IS NOT NULL THEN
                SELECT current_stock, name, code
                INTO v_current_stock, v_mat_name, v_mat_code
                FROM public.materials
                WHERE id = v_mat_id
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Material com ID % não encontrado no catálogo.', v_mat_id;
                END IF;

                -- REGRA CRÍTICA: Se o saldo for insuficiente, REJEITAR COM ERRO (ROLLBACK TOTAL)
                IF v_current_stock < v_qty THEN
                    RAISE EXCEPTION 'Saldo insuficiente em estoque para o insumo "%" (Código: %). Saldo disponível: % %, Consumo solicitado: % %.',
                        v_mat_name, v_mat_code, v_current_stock, v_unit, v_qty, v_unit;
                END IF;

                -- Calcular novo saldo físico real
                v_new_stock := v_current_stock - v_qty;

                -- Atualizar catálogo
                UPDATE public.materials
                SET 
                    current_stock = v_new_stock,
                    updated_at = v_now
                WHERE id = v_mat_id;

                -- Gravar movimentação de saída rastreável no Kardex
                INSERT INTO public.stock_movements (
                    material_id,
                    movement_type,
                    quantity,
                    previous_stock,
                    new_stock,
                    document_reference,
                    observation,
                    user_id,
                    activity_id,
                    consumption_id,
                    created_at
                ) VALUES (
                    v_mat_id,
                    'saida_atividade',
                    v_qty,
                    v_current_stock,
                    v_new_stock,
                    v_order_number,
                    COALESCE(NULLIF(TRIM(p_observation), ''), 'Consumo apontado na OS ' || v_order_number),
                    v_user_id,
                    p_activity_id,
                    v_consumption_id,
                    v_now
                );
            END IF;
        END LOOP;
    END IF;

    -- 11. Inserir no log oficial de auditoria com idempotency_key
    INSERT INTO public.activity_audit_logs (
        activity_id,
        user_id,
        user_name_cache,
        action,
        field,
        old_value,
        new_value,
        old_progress,
        new_progress,
        consumed_materials_json,
        observation,
        idempotency_key,
        created_at
    ) VALUES (
        p_activity_id,
        v_user_id,
        v_user_name,
        'Avanço de Progresso: ' || v_current_progress || '% → ' || p_new_progress || '% (' || upper(v_calculated_status) || ')',
        'Progresso',
        v_current_progress || '%',
        p_new_progress || '%',
        v_current_progress,
        p_new_progress,
        CASE WHEN p_consumptions IS NOT NULL AND jsonb_array_length(p_consumptions) > 0 THEN p_consumptions ELSE NULL END,
        NULLIF(TRIM(p_observation), ''),
        p_idempotency_key,
        v_now
    );

    -- 12. Retorno Estruturado
    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'activity_id', p_activity_id,
        'order_number', v_order_number,
        'old_progress', v_current_progress,
        'new_progress', p_new_progress,
        'status', v_calculated_status,
        'updated_at', v_now
    );
END;
$$;

-- Conceder permissão de execução da RPC para authenticated
REVOKE ALL ON FUNCTION public.update_activity_progress_and_consumption(UUID, INTEGER, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_activity_progress_and_consumption(UUID, INTEGER, JSONB, TEXT, UUID) TO authenticated;
