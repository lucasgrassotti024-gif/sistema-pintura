-- ==============================================================================
-- Migration: 20260918000031_rpc_sync_update_activity.sql
-- Descrição: Cria a RPC transacional public.sync_update_activity(...) com
--            Controle Otimista de Concorrência (OCC) baseado em version, lock pessimista
--            (FOR UPDATE), idempotência transacional via activity_audit_logs.idempotency_key
--            com validação cruzada estrita e atomicidade completa na substituição de tags e materiais planejados.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_update_activity(
    p_activity_id UUID,
    p_expected_version INTEGER,
    p_name VARCHAR(255),
    p_service_type VARCHAR(100),
    p_description TEXT,
    p_origin_reference VARCHAR(150),
    p_area_id UUID,
    p_location_id UUID,
    p_equipment_id UUID DEFAULT NULL,
    p_custom_location_text VARCHAR(255) DEFAULT NULL,
    p_priority VARCHAR(20) DEFAULT 'media',
    p_assigned_user_id UUID DEFAULT NULL,
    p_team_id UUID DEFAULT NULL,
    p_service_quantity NUMERIC(10,2) DEFAULT NULL,
    p_service_unit VARCHAR(20) DEFAULT 'm²',
    p_planned_start_date DATE DEFAULT CURRENT_DATE,
    p_planned_end_date DATE DEFAULT CURRENT_DATE,
    p_observations TEXT DEFAULT NULL,
    p_tags JSONB DEFAULT '[]'::jsonb,
    p_planned_materials JSONB DEFAULT '[]'::jsonb,
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
    v_name_clean VARCHAR(255);
    v_order_number VARCHAR(50);
    v_current_version INTEGER;
    v_new_version INTEGER;
    v_current_status VARCHAR(30);
    v_archived_at TIMESTAMPTZ;
    v_audit_activity_id UUID;
    v_audit_action VARCHAR(100);
    v_now TIMESTAMPTZ := now();

    -- Variáveis de iteração para tags
    v_tag JSONB;
    v_tag_code VARCHAR(50);
    v_tag_is_main BOOLEAN;

    -- Variáveis de iteração para materiais planejados
    v_mat JSONB;
    v_mat_id UUID;
    v_custom_mat_name VARCHAR(150);
    v_mat_qty NUMERIC(10,2);
    v_mat_unit VARCHAR(20);
    v_area_m2 NUMERIC(10,2);
    v_coats INTEGER;
    v_consumption_per_m2_per_coat NUMERIC(10,4);
    v_package_type VARCHAR(50);
    v_package_volume NUMERIC(10,2);
    v_packages_required INTEGER;
BEGIN
    -- 1. Validar Autenticação Estrita
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: Usuário não autenticado.';
    END IF;

    -- 2. Validar Autorização via Modelo Híbrido
    IF NOT public.has_permission('atividades.editar') THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui a permissão atividades.editar.';
    END IF;

    -- 3. Validar Parâmetros Obrigatórios
    IF p_activity_id IS NULL THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente: activity_id.';
    END IF;

    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente para sincronização: idempotency_key.';
    END IF;

    IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente: name.';
    END IF;

    IF p_area_id IS NULL OR p_location_id IS NULL THEN
        RAISE EXCEPTION 'Área e Local são obrigatórios para atualização da atividade.';
    END IF;

    IF p_planned_start_date > p_planned_end_date THEN
        RAISE EXCEPTION 'Data de início prevista não pode ser posterior à data de término.';
    END IF;

    v_name_clean := trim(p_name);

    -- 4. Bloqueio Concorrencial Transacional Exclusivo por Chave de Idempotência
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

    -- 5. Checagem de Idempotência com Validação Cruzada Estrita (ANTES da verificação de OCC)
    SELECT activity_id, action INTO v_audit_activity_id, v_audit_action
    FROM public.activity_audit_logs 
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        -- Validação Cruzada: Impede uso indevido de chave de outra atividade ou outra ação
        IF v_audit_activity_id <> p_activity_id OR v_audit_action <> 'Edição da Atividade' THEN
            RETURN jsonb_build_object(
                'success', false,
                'conflict', true,
                'code', 'IDEMPOTENCY_KEY_COLLISION',
                'activity_id', p_activity_id,
                'audit_activity_id', v_audit_activity_id,
                'message', 'A chave de idempotência informada já foi utilizada em outra atividade ou operação diferente.'
            );
        END IF;

        -- Se a mutação exata já foi gravada, retorna os dados atuais sem disparar erro de OCC
        SELECT version, order_number INTO v_current_version, v_order_number
        FROM public.activities 
        WHERE id = p_activity_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'activity_id', p_activity_id,
                'order_number', v_order_number,
                'server_version', v_current_version,
                'message', 'Atualização já processada anteriormente por esta chave de idempotência.'
            );
        END IF;
    END IF;

    -- 6. Buscar e Bloquear a Linha da Atividade (FOR UPDATE) para Serialização
    SELECT version, order_number, status, archived_at
    INTO v_current_version, v_order_number, v_current_status, v_archived_at
    FROM public.activities
    WHERE id = p_activity_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'code', 'ACTIVITY_NOT_FOUND',
            'activity_id', p_activity_id,
            'message', 'A atividade informada não foi encontrada no banco de dados.'
        );
    END IF;

    -- 7. Verificar se a Atividade está Arquivada ou Cancelada
    -- Nota: Alinhado estritamente com canEditActivity: atividade cancelada ou arquivada é bloqueada
    IF v_archived_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'code', 'ACTIVITY_ARCHIVED',
            'activity_id', p_activity_id,
            'order_number', v_order_number,
            'message', 'A atividade encontra-se arquivada e não pode ser editada.'
        );
    END IF;

    IF v_current_status = 'cancelada' THEN
        RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'code', 'ACTIVITY_CANCELLED',
            'activity_id', p_activity_id,
            'order_number', v_order_number,
            'message', 'A atividade está cancelada e não permite edições cadastrais.'
        );
    END IF;

    -- 8. CONTROLE OTIMISTA DE CONCORRÊNCIA (OCC): Comparar version
    IF p_expected_version IS NOT NULL AND v_current_version <> p_expected_version THEN
        RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'code', 'CONCURRENT_MODIFICATION',
            'activity_id', p_activity_id,
            'order_number', v_order_number,
            'current_server_version', v_current_version,
            'expected_client_version', p_expected_version,
            'message', 'Conflito de concorrência: a atividade foi modificada por outro usuário antes da sincronização.'
        );
    END IF;

    -- 9. Resolver nome do usuário autenticado para histórico de auditoria
    SELECT full_name INTO v_user_name
    FROM public.users
    WHERE id = v_user_id;

    v_new_version := v_current_version + 1;

    -- 10. Atualizar Dados Cadastrais da Atividade
    UPDATE public.activities
    SET
        name = v_name_clean,
        service_type = COALESCE(p_service_type, 'Pintura Geral'),
        description = COALESCE(p_description, v_name_clean),
        origin_reference = CASE WHEN p_origin_reference IS NOT NULL AND length(trim(p_origin_reference)) > 0 THEN trim(p_origin_reference) ELSE NULL END,
        area_id = p_area_id,
        location_id = p_location_id,
        equipment_id = p_equipment_id,
        custom_location_text = CASE WHEN p_custom_location_text IS NOT NULL AND length(trim(p_custom_location_text)) > 0 THEN trim(p_custom_location_text) ELSE NULL END,
        priority = COALESCE(p_priority, 'media'),
        assigned_user_id = p_assigned_user_id,
        team_id = p_team_id,
        service_quantity = p_service_quantity,
        service_unit = COALESCE(p_service_unit, 'm²'),
        planned_start_date = p_planned_start_date,
        planned_end_date = p_planned_end_date,
        observations = CASE WHEN p_observations IS NOT NULL AND length(trim(p_observations)) > 0 THEN trim(p_observations) ELSE NULL END,
        version = v_new_version,
        updated_at = v_now
    WHERE id = p_activity_id;

    -- 11. Substituição Atômica de Tags
    DELETE FROM public.activity_tags WHERE activity_id = p_activity_id;

    IF p_tags IS NOT NULL AND jsonb_typeof(p_tags) = 'array' AND jsonb_array_length(p_tags) > 0 THEN
        FOR v_tag IN SELECT * FROM jsonb_array_elements(p_tags)
        LOOP
            v_tag_code := upper(trim(COALESCE(v_tag->>'tag_code', v_tag->>'code', '')));
            v_tag_is_main := COALESCE((v_tag->>'is_main')::boolean, false);

            IF length(v_tag_code) > 0 THEN
                INSERT INTO public.activity_tags (
                    activity_id,
                    tag_code,
                    is_main,
                    created_at
                ) VALUES (
                    p_activity_id,
                    v_tag_code,
                    v_tag_is_main,
                    v_now
                ) ON CONFLICT (activity_id, tag_code) DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- 12. Substituição Atômica de Materiais Planejados
    DELETE FROM public.activity_planned_materials WHERE activity_id = p_activity_id;

    IF p_planned_materials IS NOT NULL AND jsonb_typeof(p_planned_materials) = 'array' AND jsonb_array_length(p_planned_materials) > 0 THEN
        FOR v_mat IN SELECT * FROM jsonb_array_elements(p_planned_materials)
        LOOP
            v_mat_id := NULL;
            IF v_mat->>'material_id' IS NOT NULL AND length(v_mat->>'material_id') > 0 THEN
                v_mat_id := (v_mat->>'material_id')::UUID;
            END IF;

            v_custom_mat_name := trim(COALESCE(v_mat->>'custom_material_name', v_mat->>'materialName', ''));
            v_mat_qty := COALESCE((v_mat->>'planned_quantity')::numeric, (v_mat->>'quantity')::numeric, 0.00);
            v_mat_unit := trim(COALESCE(v_mat->>'unit', 'L'));

            -- Parâmetros técnicos do dimensionamento
            v_area_m2 := NULL;
            IF v_mat->>'area_m2' IS NOT NULL OR v_mat->>'areaM2' IS NOT NULL THEN
                v_area_m2 := COALESCE((v_mat->>'area_m2')::numeric, (v_mat->>'areaM2')::numeric);
            END IF;

            v_coats := NULL;
            IF v_mat->>'coats' IS NOT NULL THEN
                v_coats := (v_mat->>'coats')::integer;
            END IF;

            v_consumption_per_m2_per_coat := NULL;
            IF v_mat->>'consumption_per_m2_per_coat' IS NOT NULL OR v_mat->>'consumptionPerM2PerCoat' IS NOT NULL THEN
                v_consumption_per_m2_per_coat := COALESCE((v_mat->>'consumption_per_m2_per_coat')::numeric, (v_mat->>'consumptionPerM2PerCoat')::numeric);
            END IF;

            v_package_type := NULL;
            IF v_mat->>'package_type' IS NOT NULL OR v_mat->>'packageType' IS NOT NULL THEN
                v_package_type := COALESCE(v_mat->>'package_type', v_mat->>'packageType');
            END IF;

            v_package_volume := NULL;
            IF v_mat->>'package_volume' IS NOT NULL OR v_mat->>'packageVolume' IS NOT NULL THEN
                v_package_volume := COALESCE((v_mat->>'package_volume')::numeric, (v_mat->>'packageVolume')::numeric);
            END IF;

            v_packages_required := NULL;
            IF v_mat->>'packages_required' IS NOT NULL OR v_mat->>'packagesRequired' IS NOT NULL THEN
                v_packages_required := COALESCE((v_mat->>'packages_required')::integer, (v_mat->>'packagesRequired')::integer);
            END IF;

            -- Resolução de vínculo por nome se material_id não for fornecido
            IF v_mat_id IS NULL AND length(v_custom_mat_name) > 0 THEN
                SELECT id INTO v_mat_id
                FROM public.materials
                WHERE lower(trim(name)) = lower(v_custom_mat_name)
                LIMIT 1;
            END IF;

            IF v_mat_qty > 0 AND length(v_custom_mat_name) > 0 THEN
                INSERT INTO public.activity_planned_materials (
                    activity_id,
                    material_id,
                    custom_material_name,
                    planned_quantity,
                    unit,
                    area_m2,
                    coats,
                    consumption_per_m2_per_coat,
                    package_type,
                    package_volume,
                    packages_required,
                    created_at
                ) VALUES (
                    p_activity_id,
                    v_mat_id,
                    v_custom_mat_name,
                    v_mat_qty,
                    v_mat_unit,
                    v_area_m2,
                    v_coats,
                    v_consumption_per_m2_per_coat,
                    v_package_type,
                    v_package_volume,
                    v_packages_required,
                    v_now
                );
            END IF;
        END LOOP;
    END IF;

    -- 13. Registrar Log Oficial de Auditoria com idempotency_key na MESMA transação
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
        observation,
        idempotency_key,
        created_at
    ) VALUES (
        p_activity_id,
        v_user_id,
        COALESCE(v_user_name, 'Usuário Autenticado'),
        'Edição da Atividade',
        'Revisão Cadastral',
        'v' || v_current_version,
        'v' || v_new_version,
        NULL,
        NULL,
        CASE WHEN p_observations IS NOT NULL AND length(trim(p_observations)) > 0 THEN trim(p_observations) ELSE 'Dados cadastrais atualizados' END,
        p_idempotency_key,
        v_now
    );

    -- 14. Retorno Estruturado Conforme Contrato do Sync Engine
    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'activity_id', p_activity_id,
        'order_number', v_order_number,
        'server_version', v_new_version,
        'updated_at', v_now
    );
END;
$$;

-- Privilégios de Execução
REVOKE ALL ON FUNCTION public.sync_update_activity FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_update_activity TO authenticated;
