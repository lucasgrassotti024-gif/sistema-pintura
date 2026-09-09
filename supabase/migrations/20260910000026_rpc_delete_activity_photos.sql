-- ==============================================================================
-- Migration: 20260910000026_rpc_delete_activity_photos.sql
-- Descrição: RPC segura para exclusão controlada de fotos de atividades:
--            1. Valida autenticação e permissão 'atividades.editar'
--            2. Valida vínculo com a atividade especificada (impede cruzamento)
--            3. Remove registros em public.activity_photos
--            4. Remove registros órfãos em public.activity_photo_records
--            5. Registra auditoria em public.activity_audit_logs
--            6. Retorna os storage_paths das fotos removidas para limpeza no Storage
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.delete_activity_photos(
    p_activity_id UUID,
    p_photo_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_activity_order VARCHAR(50);
    v_storage_paths TEXT[] := ARRAY[]::TEXT[];
    v_deleted_count INTEGER := 0;
    v_now TIMESTAMPTZ := now();
    v_record_ids UUID[];
BEGIN
    -- 1. Validar Autenticação
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: Usuário não autenticado.';
    END IF;

    -- 2. Validar Autorização estrita via public.has_permission
    IF NOT public.has_permission('atividades.editar') THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui a permissão atividades.editar para remover fotos.';
    END IF;

    -- 3. Validar Parâmetros de Entrada
    IF p_activity_id IS NULL THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente: activity_id.';
    END IF;

    IF p_photo_ids IS NULL OR array_length(p_photo_ids, 1) IS NULL OR array_length(p_photo_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'deleted_count', 0,
            'storage_paths', ARRAY[]::TEXT[]
        );
    END IF;

    -- 4. Verificar se a atividade existe e obter número de OS
    SELECT order_number INTO v_activity_order
    FROM public.activities
    WHERE id = p_activity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Atividade não encontrada com o ID: %', p_activity_id;
    END IF;

    SELECT full_name INTO v_user_name
    FROM public.users
    WHERE id = v_user_id;

    -- 5. Coletar e validar fotos que realmente pertencem a esta atividade específica
    SELECT 
        ARRAY_AGG(ap.storage_path),
        ARRAY_AGG(DISTINCT ap.photo_record_id),
        COUNT(ap.id)
    INTO 
        v_storage_paths,
        v_record_ids,
        v_deleted_count
    FROM public.activity_photos ap
    JOIN public.activity_photo_records apr ON apr.id = ap.photo_record_id
    WHERE apr.activity_id = p_activity_id
      AND ap.id = ANY(p_photo_ids);

    IF v_deleted_count = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'deleted_count', 0,
            'storage_paths', ARRAY[]::TEXT[]
        );
    END IF;

    -- 6. Deletar registros de fotos
    DELETE FROM public.activity_photos
    WHERE id = ANY(p_photo_ids)
      AND photo_record_id IN (
          SELECT id FROM public.activity_photo_records WHERE activity_id = p_activity_id
      );

    -- 7. Limpar sessões fotográficas (activity_photo_records) que ficaram sem nenhuma foto
    IF v_record_ids IS NOT NULL AND array_length(v_record_ids, 1) > 0 THEN
        DELETE FROM public.activity_photo_records apr
        WHERE apr.id = ANY(v_record_ids)
          AND NOT EXISTS (
              SELECT 1 FROM public.activity_photos ap WHERE ap.photo_record_id = apr.id
          );
    END IF;

    -- 8. Registrar Log de Auditoria Imutável
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
        'Exclusão de Fotos',
        'Fotos de Evidência',
        v_deleted_count || ' foto(s) removida(s)',
        NULL,
        'Remoção de ' || v_deleted_count || ' foto(s) da OS ' || v_activity_order || ' via formulário de atividade.',
        v_now
    );

    -- 9. Retornar dados para limpeza no Storage
    RETURN jsonb_build_object(
        'success', true,
        'activity_id', p_activity_id,
        'deleted_count', v_deleted_count,
        'storage_paths', COALESCE(v_storage_paths, ARRAY[]::TEXT[])
    );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_activity_photos(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_activity_photos(UUID, UUID[]) TO authenticated;
