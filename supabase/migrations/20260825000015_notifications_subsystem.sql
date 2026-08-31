-- ==============================================================================
-- Migration: 20260825000015_notifications_subsystem.sql
-- Descrição: Implementa o subsistema de Notificações Operacionais e Leitura Individual
--            com suporte a idempotência estrita via event_key, isolamento RLS e RPC
--            de sincronização de ocorrências reais (atividades e estoque).
--
-- Tabelas criadas:
--   1. public.notifications (Histórico imutável de notificações operacionais)
--   2. public.notification_reads (Controle individual de leitura por usuário)
--
-- RPC criada:
--   - public.sync_operational_notifications() -> JSONB (SECURITY DEFINER)
--   - public.mark_all_notifications_as_read() -> JSONB (SECURITY DEFINER)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA: public.notifications (Ocorrências do Sistema)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_key VARCHAR(180) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,                -- 'atividades', 'estoque', 'sistema'
    severity VARCHAR(20) NOT NULL,                -- 'info', 'alerta', 'urgente'
    title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    link_href VARCHAR(255),                       -- Ex: '/pintura/atividades', '/pintura/materiais-estoque'
    entity_type VARCHAR(50),                      -- 'activity', 'material'
    entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints de Integridade
    CONSTRAINT chk_notifications_category CHECK (category IN ('atividades', 'estoque', 'sistema')),
    CONSTRAINT chk_notifications_severity CHECK (severity IN ('info', 'alerta', 'urgente'))
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_notifications_event_key ON public.notifications(event_key);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(category);

-- ------------------------------------------------------------------------------
-- 2. TABELA: public.notification_reads (Leitura Individual por Usuário)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_reads (
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (notification_id, user_id)
);

-- Índices de Performance para Leituras
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads(user_id);

-- ------------------------------------------------------------------------------
-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. CONCESSÃO DE PRIVILÉGIOS (GRANTS)
-- ------------------------------------------------------------------------------
GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. POLÍTICAS RLS (Row Level Security)
-- ------------------------------------------------------------------------------

-- 5.1. public.notifications: Leitura para usuários autenticados ativos
DROP POLICY IF EXISTS "policy_notifications_select_authenticated" ON public.notifications;
CREATE POLICY "policy_notifications_select_authenticated"
ON public.notifications
FOR SELECT
TO authenticated
USING (
    -- Permite visualização se o usuário estiver ativo
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.active = true
    )
);

-- 5.2. public.notification_reads: Usuário acessa e manipula estritamente seus próprios registros
DROP POLICY IF EXISTS "policy_notification_reads_select_own" ON public.notification_reads;
CREATE POLICY "policy_notification_reads_select_own"
ON public.notification_reads
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "policy_notification_reads_insert_own" ON public.notification_reads;
CREATE POLICY "policy_notification_reads_insert_own"
ON public.notification_reads
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "policy_notification_reads_delete_own" ON public.notification_reads;
CREATE POLICY "policy_notification_reads_delete_own"
ON public.notification_reads
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 6. RPC: public.sync_operational_notifications
-- Sincroniza e detecta ocorrências reais no banco de forma atômica e idempotente
-- (ON CONFLICT (event_key) DO NOTHING).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_operational_notifications()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_inserted_count INTEGER := 0;
    v_today DATE := CURRENT_DATE;
    v_tomorrow DATE := CURRENT_DATE + INTERVAL '1 day';
    
    -- Variáveis de cursor
    v_act RECORD;
    v_mat RECORD;
    v_last_valid_entry_id UUID;
    v_event_key VARCHAR(180);
BEGIN
    -- 1. Validar autenticação
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: Usuário não autenticado.';
    END IF;

    -- ==========================================================================
    -- A. ATIVIDADES
    -- ==========================================================================

    -- A1. Atividades em Atraso (planned_end_date < v_today e não concluídas/canceladas)
    FOR v_act IN
        SELECT id, order_number, name, planned_end_date, progress_percentage
        FROM public.activities
        WHERE status NOT IN ('concluida', 'cancelada')
          AND planned_end_date < v_today
    LOOP
        v_event_key := 'activity_delayed:' || v_act.id::TEXT || ':' || v_act.planned_end_date::TEXT;

        INSERT INTO public.notifications (
            event_key,
            category,
            severity,
            title,
            message,
            link_href,
            entity_type,
            entity_id,
            created_at
        ) VALUES (
            v_event_key,
            'atividades',
            'urgente',
            'Atividade em atraso: ' || v_act.order_number,
            'A atividade ' || v_act.name || ' ultrapassou o prazo planejado (' || to_char(v_act.planned_end_date, 'DD/MM/YYYY') || ') com ' || v_act.progress_percentage || '% de progresso.',
            '/pintura/atividades',
            'activity',
            v_act.id,
            now()
        )
        ON CONFLICT (event_key) DO NOTHING;

        IF FOUND THEN
            v_inserted_count := v_inserted_count + 1;
        END IF;
    END LOOP;

    -- A2. Prazo Próximo (planned_end_date IN (hoje, amanhã), ativa, não concluída e progresso < 80%)
    FOR v_act IN
        SELECT id, order_number, name, planned_end_date, progress_percentage
        FROM public.activities
        WHERE status NOT IN ('concluida', 'cancelada')
          AND planned_end_date >= v_today
          AND planned_end_date <= v_tomorrow
          AND progress_percentage < 80
    LOOP
        v_event_key := 'activity_due_soon:' || v_act.id::TEXT || ':' || v_act.planned_end_date::TEXT;

        INSERT INTO public.notifications (
            event_key,
            category,
            severity,
            title,
            message,
            link_href,
            entity_type,
            entity_id,
            created_at
        ) VALUES (
            v_event_key,
            'atividades',
            'alerta',
            'Prazo próximo: ' || v_act.order_number,
            'A atividade ' || v_act.name || ' vence em ' || to_char(v_act.planned_end_date, 'DD/MM/YYYY') || ' e está com ' || v_act.progress_percentage || '% concluída.',
            '/pintura/atividades',
            'activity',
            v_act.id,
            now()
        )
        ON CONFLICT (event_key) DO NOTHING;

        IF FOUND THEN
            v_inserted_count := v_inserted_count + 1;
        END IF;
    END LOOP;

    -- A3. Atividades Canceladas (status = 'cancelada')
    FOR v_act IN
        SELECT id, order_number, name, cancellation_reason
        FROM public.activities
        WHERE status = 'cancelada'
    LOOP
        v_event_key := 'activity_cancelled:' || v_act.id::TEXT;

        INSERT INTO public.notifications (
            event_key,
            category,
            severity,
            title,
            message,
            link_href,
            entity_type,
            entity_id,
            created_at
        ) VALUES (
            v_event_key,
            'atividades',
            'urgente',
            'Atividade cancelada: ' || v_act.order_number,
            'A atividade ' || v_act.name || ' foi cancelada. Motivo: ' || COALESCE(v_act.cancellation_reason, 'Não informado.'),
            '/pintura/atividades',
            'activity',
            v_act.id,
            now()
        )
        ON CONFLICT (event_key) DO NOTHING;

        IF FOUND THEN
            v_inserted_count := v_inserted_count + 1;
        END IF;
    END LOOP;

    -- A4. Atividades Concluídas (status = 'concluida')
    FOR v_act IN
        SELECT id, order_number, name
        FROM public.activities
        WHERE status = 'concluida'
    LOOP
        v_event_key := 'activity_completed:' || v_act.id::TEXT;

        INSERT INTO public.notifications (
            event_key,
            category,
            severity,
            title,
            message,
            link_href,
            entity_type,
            entity_id,
            created_at
        ) VALUES (
            v_event_key,
            'atividades',
            'info',
            'Atividade concluída: ' || v_act.order_number,
            'A atividade ' || v_act.name || ' atingiu 100% de avanço e foi finalizada.',
            '/pintura/atividades',
            'activity',
            v_act.id,
            now()
        )
        ON CONFLICT (event_key) DO NOTHING;

        IF FOUND THEN
            v_inserted_count := v_inserted_count + 1;
        END IF;
    END LOOP;

    -- ==========================================================================
    -- B. ESTOQUE (Materiais com Saldo Crítico ou Zerado)
    -- ==========================================================================

    FOR v_mat IN
        SELECT id, code, name, current_stock, minimum_stock, unit
        FROM public.materials
        WHERE active = true
          AND current_stock <= minimum_stock
    LOOP
        -- Localiza a última movimentação de entrada que reabasteceu o estoque
        -- acima do mínimo (ou seja, new_stock >= minimum_stock).
        -- Entradas parciais que mantiveram o saldo abaixo do mínimo não alteram esse ID.
        SELECT sm.id INTO v_last_valid_entry_id
        FROM public.stock_movements sm
        WHERE sm.material_id = v_mat.id
          AND sm.movement_type = 'entrada'
          AND sm.new_stock >= v_mat.minimum_stock
        ORDER BY sm.created_at DESC
        LIMIT 1;

        -- B1. Estoque Zerado (current_stock = 0.00)
        IF v_mat.current_stock = 0.00 THEN
            v_event_key := 'material_zero_stock:' || v_mat.id::TEXT || ':' || COALESCE(v_last_valid_entry_id::TEXT, 'initial');

            INSERT INTO public.notifications (
                event_key,
                category,
                severity,
                title,
                message,
                link_href,
                entity_type,
                entity_id,
                created_at
            ) VALUES (
                v_event_key,
                'estoque',
                'urgente',
                'Estoque zerado: ' || v_mat.name,
                'O insumo ' || v_mat.code || ' (' || v_mat.name || ') está completamente esgotado (Saldo: 0 ' || v_mat.unit || ').',
                '/pintura/materiais-estoque',
                'material',
                v_mat.id,
                now()
            )
            ON CONFLICT (event_key) DO NOTHING;

            IF FOUND THEN
                v_inserted_count := v_inserted_count + 1;
            END IF;
        END IF;

        -- B2. Estoque Abaixo do Mínimo (0 < current_stock < minimum_stock)
        IF v_mat.current_stock > 0.00 AND v_mat.current_stock < v_mat.minimum_stock THEN
            v_event_key := 'material_below_min:' || v_mat.id::TEXT || ':' || COALESCE(v_last_valid_entry_id::TEXT, 'initial');

            INSERT INTO public.notifications (
                event_key,
                category,
                severity,
                title,
                message,
                link_href,
                entity_type,
                entity_id,
                created_at
            ) VALUES (
                v_event_key,
                'estoque',
                'alerta',
                'Estoque abaixo do mínimo: ' || v_mat.name,
                'O insumo ' || v_mat.name || ' está com saldo de ' || v_mat.current_stock || ' ' || v_mat.unit || ' (Mínimo: ' || v_mat.minimum_stock || ' ' || v_mat.unit || ').',
                '/pintura/materiais-estoque',
                'material',
                v_mat.id,
                now()
            )
            ON CONFLICT (event_key) DO NOTHING;

            IF FOUND THEN
                v_inserted_count := v_inserted_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'new_notifications_count', v_inserted_count,
        'synced_at', now()
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. RPC: public.mark_all_notifications_as_read
-- Marca todas as notificações existentes como lidas para o usuário atual
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_marked_count INTEGER := 0;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: Usuário não autenticado.';
    END IF;

    -- Insere leitura para todas as notificações ainda não lidas pelo usuário
    INSERT INTO public.notification_reads (notification_id, user_id, read_at)
    SELECT n.id, v_user_id, now()
    FROM public.notifications n
    WHERE NOT EXISTS (
        SELECT 1 FROM public.notification_reads nr
        WHERE nr.notification_id = n.id AND nr.user_id = v_user_id
    )
    ON CONFLICT (notification_id, user_id) DO NOTHING;

    GET DIAGNOSTICS v_marked_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'marked_count', v_marked_count
    );
END;
$$;

-- Privilégios de Execução das RPCs para authenticated
GRANT EXECUTE ON FUNCTION public.sync_operational_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_as_read TO authenticated;
