-- ==============================================================================
-- Migration: 20260918000033_idempotent_photo_session.sql
-- Descrição: Evolui public.start_photo_record_session(p_activity_id, p_observation, p_photo_record_id)
--            para suportar identificador de sessão pré-definido pelo cliente (UUID local):
--            1. Remove a assinatura antiga de 2 parâmetros via DROP FUNCTION para evitar overload ambíguo no PostgreSQL.
--            2. Recria aceitando p_photo_record_id UUID DEFAULT NULL (preservando chamadas online legadas de 2 argumentos).
--            3. Se p_photo_record_id for fornecido e já existir sessão pendente do mesmo usuário/atividade:
--               reaproveita a sessão existente sem criar duplicatas no banco.
--            4. Se a sessão informada já estiver 'confirmado', retorna sucesso idempotente imediato.
--            5. Se p_photo_record_id for omitido (NULL), gera uuid_generate_v4() (100% retrocompatível).
-- ==============================================================================

-- 1. Elimina a assinatura de 2 parâmetros para prevenir colisão/ambiguidade de overload
DROP FUNCTION IF EXISTS public.start_photo_record_session(UUID, TEXT);

-- 2. Recria a função com o parâmetro opcional p_photo_record_id
CREATE OR REPLACE FUNCTION public.start_photo_record_session(
    p_activity_id UUID,
    p_observation TEXT DEFAULT NULL,
    p_photo_record_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_current_progress INTEGER;
    v_record_id UUID;
    v_existing_user_id UUID;
    v_existing_activity_id UUID;
    v_existing_status VARCHAR(20);
    v_existing_progress INTEGER;
    v_existing_photos_count INTEGER;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- 1. Validar Autenticação
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: Usuário não autenticado.';
    END IF;

    -- 2. Validar Autorização via Modelo Híbrido
    IF NOT public.has_permission('atividades.fotos.registrar') THEN
        RAISE EXCEPTION 'Permissão negada: o usuário não possui a permissão atividades.fotos.registrar.';
    END IF;

    -- 3. Validar Parâmetro Obrigatório
    IF p_activity_id IS NULL THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente: activity_id.';
    END IF;

    -- 4. Verificar se a Atividade Existe e Congelar o Progresso Atual
    SELECT progress_percentage INTO v_current_progress
    FROM public.activities
    WHERE id = p_activity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Atividade não encontrada com o ID: %', p_activity_id;
    END IF;

    -- 5. Tratamento de ID de Sessão Pré-definido pelo Cliente (Idempotência Estável)
    IF p_photo_record_id IS NOT NULL THEN
        -- Bloqueio Concorrencial Exclusivo por ID de Sessão
        PERFORM pg_advisory_xact_lock(hashtextextended(p_photo_record_id::text, 0));

        SELECT user_id, activity_id, status, progress_percentage
        INTO v_existing_user_id, v_existing_activity_id, v_existing_status, v_existing_progress
        FROM public.activity_photo_records
        WHERE id = p_photo_record_id;

        IF FOUND THEN
            -- Validação de Segurança: Impede que outro usuário reutilize sessão alheia
            IF v_existing_user_id <> v_user_id THEN
                RAISE EXCEPTION 'Acesso negado: o identificador de sessão pertence a outro usuário.';
            END IF;

            -- Validação de Vínculo: Impede associar a sessão a outra atividade
            IF v_existing_activity_id <> p_activity_id THEN
                RAISE EXCEPTION 'Conflito de sessão: este identificador já está vinculado a outra atividade.';
            END IF;

            -- Se já foi confirmada anteriormente, retorna sucesso idempotente imediato
            IF v_existing_status = 'confirmado' THEN
                SELECT count(*) INTO v_existing_photos_count
                FROM public.activity_photos
                WHERE photo_record_id = p_photo_record_id;

                RETURN jsonb_build_object(
                    'photo_record_id', p_photo_record_id,
                    'activity_id', p_activity_id,
                    'progress_percentage', v_existing_progress,
                    'photos_count', v_existing_photos_count,
                    'status', 'confirmado',
                    'idempotent', true,
                    'message', 'Sessão fotográfica já confirmada anteriormente.'
                );
            END IF;

            -- Se ainda está pendente, reaproveita a sessão existente sem duplicar
            RETURN jsonb_build_object(
                'photo_record_id', p_photo_record_id,
                'activity_id', p_activity_id,
                'progress_percentage', v_existing_progress,
                'status', 'pendente',
                'idempotent', true,
                'reused', true,
                'message', 'Sessão fotográfica pendente reaproveitada com sucesso.'
            );
        END IF;

        -- Se não existe, adota o p_photo_record_id fornecido
        v_record_id := p_photo_record_id;
    ELSE
        -- Se p_photo_record_id não foi informado, gera novo UUID (fluxo online tradicional)
        v_record_id := uuid_generate_v4();
    END IF;

    -- Obter nome do usuário autenticado para cache
    SELECT full_name INTO v_user_name
    FROM public.users
    WHERE id = v_user_id;

    -- 6. Inserir Nova Sessão em public.activity_photo_records
    INSERT INTO public.activity_photo_records (
        id,
        activity_id,
        user_id,
        user_name_cache,
        progress_percentage,
        observation,
        status,
        created_at
    ) VALUES (
        v_record_id,
        p_activity_id,
        v_user_id,
        COALESCE(v_user_name, 'Usuário Autenticado'),
        COALESCE(v_current_progress, 0),
        CASE WHEN p_observation IS NOT NULL AND length(trim(p_observation)) > 0 THEN trim(p_observation) ELSE NULL END,
        'pendente',
        v_now
    );

    -- 7. Retorno Estruturado Conforme Contrato do Sync Engine
    RETURN jsonb_build_object(
        'photo_record_id', v_record_id,
        'activity_id', p_activity_id,
        'progress_percentage', COALESCE(v_current_progress, 0),
        'status', 'pendente',
        'idempotent', false
    );
END;
$$;

-- Privilégios de Execução
REVOKE ALL ON FUNCTION public.start_photo_record_session(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_photo_record_session(UUID, TEXT, UUID) TO authenticated;
