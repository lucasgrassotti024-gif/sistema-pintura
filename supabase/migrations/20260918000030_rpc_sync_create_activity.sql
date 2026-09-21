-- ==============================================================================
-- Migration: 20260918000030_rpc_sync_create_activity.sql
-- Descrição: Cria a RPC transacional e idempotente public.sync_create_activity(...)
--            para criação de atividades offline/online com suporte a retry seguro,
--            lock concorrencial por chave de idempotência obrigatória e atomicidade total entre:
--            activities, activity_tags, activity_planned_materials e activity_audit_logs.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_create_activity(
    p_activity_id UUID,
    p_order_number VARCHAR(50),
    p_name VARCHAR(255),
    p_service_type VARCHAR(100),
    p_description TEXT,
    p_origin_reference VARCHAR(150),
    p_area_id UUID,
    p_location_id UUID,
    p_equipment_id UUID DEFAULT NULL,
    p_custom_location_text VARCHAR(255) DEFAULT NULL,
    p_status VARCHAR(30) DEFAULT 'programada',
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
    v_order_clean VARCHAR(50);
    v_name_clean VARCHAR(255);
    v_existing_id UUID;
    v_existing_version INTEGER;
    v_existing_order VARCHAR(50);
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
    IF NOT public.has_permission('atividades.criar') THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui a permissão atividades.criar.';
    END IF;

    -- 3. Validação dos Parâmetros Obrigatórios
    IF p_activity_id IS NULL THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente: activity_id.';
    END IF;

    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente para sincronização: idempotency_key.';
    END IF;

    IF p_order_number IS NULL OR length(trim(p_order_number)) = 0 THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente: order_number.';
    END IF;

    IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente: name.';
    END IF;

    IF p_area_id IS NULL OR p_location_id IS NULL THEN
        RAISE EXCEPTION 'Área e Local são obrigatórios para cadastro da atividade.';
    END IF;

    IF p_planned_start_date > p_planned_end_date THEN
        RAISE EXCEPTION 'Data de início prevista não pode ser posterior à data de término.';
    END IF;

    v_order_clean := upper(trim(p_order_number));
    v_name_clean := trim(p_name);

    -- 4. Bloqueio Concorrencial Transacional Exclusivo por Chave de Idempotência
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

    -- 5. Checagem de Idempotência com Validação Cruzada Estrita
    SELECT activity_id, action INTO v_audit_activity_id, v_audit_action
    FROM public.activity_audit_logs 
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        -- Validação Cruzada: A chave precisa pertencer EXATAMENTE à mesma activity_id e à ação de criação
        IF v_audit_activity_id <> p_activity_id OR v_audit_action <> 'Criação da Atividade' THEN
            RETURN jsonb_build_object(
                'success', false,
                'conflict', true,
                'code', 'IDEMPOTENCY_KEY_COLLISION',
                'activity_id', p_activity_id,
                'audit_activity_id', v_audit_activity_id,
                'message', 'A chave de idempotência informada já foi utilizada em outra atividade ou operação diferente.'
            );
        END IF;

        -- Recupera os dados da atividade real persistida
        SELECT id, version, order_number 
        INTO v_existing_id, v_existing_version, v_existing_order
        FROM public.activities 
        WHERE id = p_activity_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'activity_id', v_existing_id,
                'order_number', v_existing_order,
                'server_version', v_existing_version,
                'message', 'Criação já processada anteriormente com sucesso.'
            );
        END IF;
    END IF;

    -- 6. Bloqueio Concorrencial por ID da Atividade e por Número de Ordem
    PERFORM pg_advisory_xact_lock(hashtextextended(p_activity_id::text, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended(v_order_clean, 0));

    -- 7. Verificar se o activity_id já existe por outra mutação anterior
    IF EXISTS (SELECT 1 FROM public.activities WHERE id = p_activity_id) THEN
        SELECT version, order_number INTO v_existing_version, v_existing_order
        FROM public.activities
        WHERE id = p_activity_id;

        RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'code', 'ACTIVITY_ID_ALREADY_EXISTS',
            'activity_id', p_activity_id,
            'order_number', v_existing_order,
            'server_version', v_existing_version,
            'message', 'Já existe uma atividade cadastrada com este ID.'
        );
    END IF;

    -- 8. Verificar se o order_number já pertence a outra atividade no sistema
    IF EXISTS (SELECT 1 FROM public.activities WHERE order_number = v_order_clean) THEN
        SELECT id, version INTO v_existing_id, v_existing_version
        FROM public.activities
        WHERE order_number = v_order_clean;

        RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'code', 'ORDER_NUMBER_DUPLICATE',
            'order_number', v_order_clean,
            'existing_activity_id', v_existing_id,
            'server_version', v_existing_version,
            'message', 'O número de Nota/OS informado já está cadastrado em outra atividade.'
        );
    END IF;

    -- 9. Resolver nome do usuário autenticado para histórico de auditoria
    SELECT full_name INTO v_user_name
    FROM public.users
    WHERE id = v_user_id;

    -- 10. Inserir a Atividade Principal em public.activities (com version = 1)
    INSERT INTO public.activities (
        id,
        order_number,
        name,
        service_type,
        description,
        origin_reference,
        area_id,
        location_id,
        equipment_id,
        custom_location_text,
        status,
        priority,
        progress_percentage,
        assigned_user_id,
        team_id,
        service_quantity,
        service_unit,
        planned_start_date,
        planned_end_date,
        observations,
        version,
        created_at,
        updated_at
    ) VALUES (
        p_activity_id,
        v_order_clean,
        v_name_clean,
        COALESCE(p_service_type, 'Pintura Geral'),
        COALESCE(p_description, v_name_clean),
        CASE WHEN p_origin_reference IS NOT NULL AND length(trim(p_origin_reference)) > 0 THEN trim(p_origin_reference) ELSE NULL END,
        p_area_id,
        p_location_id,
        p_equipment_id,
        CASE WHEN p_custom_location_text IS NOT NULL AND length(trim(p_custom_location_text)) > 0 THEN trim(p_custom_location_text) ELSE NULL END,
        COALESCE(p_status, 'programada'),
        COALESCE(p_priority, 'media'),
        0,
        p_assigned_user_id,
        p_team_id,
        p_service_quantity,
        COALESCE(p_service_unit, 'm²'),
        p_planned_start_date,
        p_planned_end_date,
        CASE WHEN p_observations IS NOT NULL AND length(trim(p_observations)) > 0 THEN trim(p_observations) ELSE NULL END,
        1,
        v_now,
        v_now
    );

    -- 11. Inserir Tags em public.activity_tags
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

    -- 12. Inserir Materiais Planejados em public.activity_planned_materials
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

            -- Parâmetros técnicos do dimensionamento por m²
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

            -- Se não foi passado material_id mas foi passado custom_material_name, tenta vincular ao catálogo pelo nome
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
        'Criação da Atividade',
        'Cadastro Inicial',
        NULL,
        v_order_clean,
        NULL,
        0,
        CASE WHEN p_observations IS NOT NULL AND length(trim(p_observations)) > 0 THEN trim(p_observations) ELSE 'Atividade cadastrada no sistema' END,
        p_idempotency_key,
        v_now
    );

    -- 14. Retorno Estruturado Conforme Contrato do Sync Engine
    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'activity_id', p_activity_id,
        'order_number', v_order_clean,
        'server_version', 1,
        'created_at', v_now
    );
END;
$$;

-- Privilégios de Execução
REVOKE ALL ON FUNCTION public.sync_create_activity FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_create_activity TO authenticated;
