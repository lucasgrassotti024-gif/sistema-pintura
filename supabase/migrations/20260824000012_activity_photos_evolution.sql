-- ==============================================================================
-- Migration: 20260824000012_activity_photos_evolution.sql
-- Descrição: Módulo de Registro Fotográfico e Evolução da Atividade:
--            1. Catálogo e matriz de permissão (atividades.fotos.registrar)
--            2. Tabelas public.activity_photo_records e public.activity_photos
--            3. RPCs com FOR UPDATE, idempotência e search_path estrito:
--               - public.start_photo_record_session
--               - public.abort_photo_record_session
--               - public.confirm_photo_record_session
--            4. Bucket privado 'activity-photos' e policies blindadas contra cast errors
--            5. Auditoria rigorosa em public.activity_audit_logs
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CATÁLOGO DE PERMISSÕES E MATRIZ POR CARGO
-- ------------------------------------------------------------------------------
INSERT INTO public.permissions (id, category, name, description)
VALUES (
    'atividades.fotos.registrar',
    'atividades',
    'Registrar Fotos da Atividade',
    'Permite registrar fotos de evolução e marcos fotográficos da atividade'
)
ON CONFLICT (id) DO UPDATE
SET 
    category = EXCLUDED.category,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Conceder aos 5 cargos operacionais e técnicos
INSERT INTO public.role_base_permissions (role, permission_id)
VALUES 
    ('operador', 'atividades.fotos.registrar'),
    ('inspetor', 'atividades.fotos.registrar'),
    ('coordenador', 'atividades.fotos.registrar'),
    ('administrador', 'atividades.fotos.registrar'),
    ('desenvolvedor', 'atividades.fotos.registrar')
ON CONFLICT (role, permission_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. TABELA: public.activity_photo_records (Marco Fotográfico / Sessão)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_photo_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_name_cache VARCHAR(150),
    progress_percentage INTEGER NOT NULL,
    observation TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente', -- 'pendente' | 'confirmado'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,

    -- Constraints de Integridade
    CONSTRAINT chk_photo_record_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    CONSTRAINT chk_photo_record_status CHECK (status IN ('pendente', 'confirmado'))
);

-- ------------------------------------------------------------------------------
-- 3. TABELA: public.activity_photos (Metadados das Fotos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_record_id UUID NOT NULL REFERENCES public.activity_photo_records(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints de Integridade
    CONSTRAINT uq_activity_photos_storage_path UNIQUE (storage_path),
    CONSTRAINT chk_photo_file_size CHECK (file_size > 0 AND file_size <= 5242880), -- Máx 5 MB
    CONSTRAINT chk_photo_mime_type CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp'))
);

-- ------------------------------------------------------------------------------
-- 4. ÍNDICES DE PERFORMANCE
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_photo_records_activity_status ON public.activity_photo_records(activity_id, status);
CREATE INDEX IF NOT EXISTS idx_photo_records_user_id ON public.activity_photo_records(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_records_created_at ON public.activity_photo_records(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_photos_photo_record_id ON public.activity_photos(photo_record_id);

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) E PRIVILÉGIOS (GRANTS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.activity_photo_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_photos ENABLE ROW LEVEL SECURITY;

-- Conceder estritamente privilégios de SELECT para usuários autenticados
GRANT SELECT ON public.activity_photo_records TO authenticated;
GRANT SELECT ON public.activity_photos TO authenticated;

-- Leitura de Registros
DROP POLICY IF EXISTS "policy_photo_records_select" ON public.activity_photo_records;
CREATE POLICY "policy_photo_records_select"
ON public.activity_photo_records
FOR SELECT
TO authenticated
USING (
    (status = 'confirmado' AND public.has_permission('atividades.visualizar')) OR
    (status = 'pendente' AND user_id = auth.uid())
);

-- Leitura de Fotos
DROP POLICY IF EXISTS "policy_photos_select" ON public.activity_photos;
CREATE POLICY "policy_photos_select"
ON public.activity_photos
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.activity_photo_records r
        WHERE r.id = photo_record_id
          AND (
              (r.status = 'confirmado' AND public.has_permission('atividades.visualizar')) OR
              (r.status = 'pendente' AND r.user_id = auth.uid())
          )
    )
);

-- ------------------------------------------------------------------------------
-- 6. RPCs TRANSACIONAIS (SECURITY DEFINER COM SEARCH_PATH SEGURO)
-- ------------------------------------------------------------------------------

-- 6.1. Iniciar Sessão de Upload (Congela o progresso atual da atividade)
CREATE OR REPLACE FUNCTION public.start_photo_record_session(
    p_activity_id UUID,
    p_observation TEXT DEFAULT NULL
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
    v_now TIMESTAMPTZ := now();
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF NOT public.has_permission('atividades.fotos.registrar') THEN
        RAISE EXCEPTION 'Permissão negada: o usuário não possui a permissão atividades.fotos.registrar.';
    END IF;

    SELECT progress_percentage INTO v_current_progress
    FROM public.activities
    WHERE id = p_activity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Atividade não encontrada com o ID: %', p_activity_id;
    END IF;

    SELECT full_name INTO v_user_name
    FROM public.users
    WHERE id = v_user_id;

    INSERT INTO public.activity_photo_records (
        activity_id,
        user_id,
        user_name_cache,
        progress_percentage,
        observation,
        status,
        created_at
    ) VALUES (
        p_activity_id,
        v_user_id,
        COALESCE(v_user_name, 'Usuário Autenticado'),
        COALESCE(v_current_progress, 0),
        CASE WHEN p_observation IS NOT NULL AND length(trim(p_observation)) > 0 THEN trim(p_observation) ELSE NULL END,
        'pendente',
        v_now
    ) RETURNING id INTO v_record_id;

    RETURN jsonb_build_object(
        'photo_record_id', v_record_id,
        'activity_id', p_activity_id,
        'progress_percentage', COALESCE(v_current_progress, 0),
        'status', 'pendente'
    );
END;
$$;

-- 6.2. Abortar Sessão de Upload (Rollback seguro)
CREATE OR REPLACE FUNCTION public.abort_photo_record_session(
    p_photo_record_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_status VARCHAR(20);
    v_owner_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT status, user_id INTO v_status, v_owner_id
    FROM public.activity_photo_records
    WHERE id = p_photo_record_id;

    IF NOT FOUND THEN
        RETURN true;
    END IF;

    IF v_owner_id <> v_user_id THEN
        RAISE EXCEPTION 'Não é permitido abortar uma sessão de outro usuário.';
    END IF;

    IF v_status <> 'pendente' THEN
        RAISE EXCEPTION 'Não é permitido abortar um registro fotográfico já confirmado.';
    END IF;

    DELETE FROM public.activity_photo_records
    WHERE id = p_photo_record_id;

    RETURN true;
END;
$$;

-- 6.3. Confirmar Sessão de Upload (FOR UPDATE, Idempotência e Validação Estrita)
CREATE OR REPLACE FUNCTION public.confirm_photo_record_session(
    p_photo_record_id UUID,
    p_photos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_record RECORD;
    v_photo RECORD;
    v_photo_count INTEGER;
    v_existing_count INTEGER;
    v_expected_prefix TEXT;
    v_paths_array TEXT[] := ARRAY[]::TEXT[];
    v_now TIMESTAMPTZ := now();
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Bloqueio pessimista (FOR UPDATE) para serializar confirmações concorrentes
    SELECT * INTO v_record
    FROM public.activity_photo_records
    WHERE id = p_photo_record_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sessão fotográfica não encontrada.';
    END IF;

    IF v_record.user_id <> v_user_id THEN
        RAISE EXCEPTION 'Acesso negado: a sessão pertence a outro usuário.';
    END IF;

    -- Idempotência: Se já confirmada, retorna o estado existente de forma graciosa
    IF v_record.status = 'confirmado' THEN
        SELECT count(*) INTO v_existing_count
        FROM public.activity_photos
        WHERE photo_record_id = p_photo_record_id;

        RETURN jsonb_build_object(
            'photo_record_id', p_photo_record_id,
            'activity_id', v_record.activity_id,
            'progress_percentage', v_record.progress_percentage,
            'photos_count', v_existing_count,
            'status', 'confirmado',
            'confirmed_at', v_record.confirmed_at,
            'idempotent', true
        );
    END IF;

    v_photo_count := jsonb_array_length(p_photos);
    IF v_photo_count IS NULL OR v_photo_count < 1 THEN
        RAISE EXCEPTION 'É necessário informar ao menos 1 foto para confirmar o registro.';
    END IF;

    IF v_photo_count > 8 THEN
        RAISE EXCEPTION 'Limite máximo de 8 fotos por registro excedido.';
    END IF;

    v_expected_prefix := 'activities/' || v_record.activity_id::text || '/' || p_photo_record_id::text || '/';

    -- Validação estrita foto por foto
    FOR v_photo IN SELECT * FROM jsonb_to_recordset(p_photos) AS x(
        storage_path TEXT,
        original_filename VARCHAR(255),
        file_size INTEGER,
        mime_type VARCHAR(50)
    )
    LOOP
        -- 1. Validar prefixo do path
        IF v_photo.storage_path IS NULL OR NOT (v_photo.storage_path LIKE (v_expected_prefix || '%')) THEN
            RAISE EXCEPTION 'Caminho de armazenamento inválido: %', v_photo.storage_path;
        END IF;

        -- 2. Validar regex: activities/<activity_id>/<photo_record_id>/<photo_id>.<ext>
        IF NOT (v_photo.storage_path ~ ('^activities/' || v_record.activity_id::text || '/' || p_photo_record_id::text || '/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$')) THEN
            RAISE EXCEPTION 'Estrutura de arquivo ou nome de foto inválido no path: %', v_photo.storage_path;
        END IF;

        -- 3. Validar MIME type
        IF v_photo.mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
            RAISE EXCEPTION 'Tipo de arquivo não permitido: %', v_photo.mime_type;
        END IF;

        -- 4. Validar coerência extensão vs MIME
        IF (v_photo.mime_type = 'image/jpeg' AND NOT (v_photo.storage_path ~* '\.(jpg|jpeg)$')) OR
           (v_photo.mime_type = 'image/png'  AND NOT (v_photo.storage_path ~* '\.png$')) OR
           (v_photo.mime_type = 'image/webp' AND NOT (v_photo.storage_path ~* '\.webp$')) THEN
            RAISE EXCEPTION 'Inconsistência entre mime_type (%) e extensão do arquivo (%)', v_photo.mime_type, v_photo.storage_path;
        END IF;

        -- 5. Validar tamanho
        IF v_photo.file_size IS NULL OR v_photo.file_size <= 0 OR v_photo.file_size > 5242880 THEN
            RAISE EXCEPTION 'Tamanho de arquivo fora dos limites permitidos (máx 5MB): % bytes', v_photo.file_size;
        END IF;

        -- 6. Validar caminhos duplicados no mesmo lote
        IF v_photo.storage_path = ANY(v_paths_array) THEN
            RAISE EXCEPTION 'Caminho duplicado detectado no mesmo lote: %', v_photo.storage_path;
        END IF;
        v_paths_array := array_append(v_paths_array, v_photo.storage_path);

        -- 7. Validar existência física real no catálogo do Storage (qualificado explicitamente)
        IF NOT EXISTS (
            SELECT 1 FROM storage.objects 
            WHERE bucket_id = 'activity-photos' 
              AND name = v_photo.storage_path
        ) THEN
            RAISE EXCEPTION 'O arquivo físico não foi encontrado no Storage: %', v_photo.storage_path;
        END IF;

        -- Inserir metadados da foto
        INSERT INTO public.activity_photos (
            photo_record_id,
            storage_path,
            original_filename,
            file_size,
            mime_type,
            created_at
        ) VALUES (
            p_photo_record_id,
            v_photo.storage_path,
            v_photo.original_filename,
            v_photo.file_size,
            v_photo.mime_type,
            v_now
        );
    END LOOP;

    -- Confirmar o registro tornando-o imutável
    UPDATE public.activity_photo_records
    SET 
        status = 'confirmado',
        confirmed_at = v_now
    WHERE id = p_photo_record_id;

    -- Gravar log de auditoria oficial
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
        created_at
    ) VALUES (
        v_record.activity_id,
        v_user_id,
        v_record.user_name_cache,
        'Registro Fotográfico',
        'Evidência Fotográfica',
        NULL,
        v_photo_count || ' foto(s) anexada(s) ao marco de ' || v_record.progress_percentage || '%',
        v_record.progress_percentage,
        v_record.progress_percentage,
        v_record.observation,
        v_now
    );

    RETURN jsonb_build_object(
        'photo_record_id', p_photo_record_id,
        'activity_id', v_record.activity_id,
        'progress_percentage', v_record.progress_percentage,
        'photos_count', v_photo_count,
        'status', 'confirmado',
        'confirmed_at', v_now,
        'idempotent', false
    );
END;
$$;

-- Permissões de Execução das RPCs
REVOKE ALL ON FUNCTION public.start_photo_record_session(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_photo_record_session(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.abort_photo_record_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.abort_photo_record_session(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_photo_record_session(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_photo_record_session(UUID, JSONB) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. BUCKET PRIVADO E POLICIES BLINDADAS DO STORAGE (storage.objects)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'activity-photos',
    'activity-photos',
    false,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET 
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 7.1. Storage SELECT: Blindada com validação defensiva contra erros de cast
DROP POLICY IF EXISTS "policy_storage_activity_photos_select" ON storage.objects;
CREATE POLICY "policy_storage_activity_photos_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'activity-photos' AND
    name ~ '^activities/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$' AND
    EXISTS (
        SELECT 1 
        FROM public.activity_photo_records r
        JOIN public.activities a ON a.id = r.activity_id
        WHERE a.id = (CASE WHEN name ~ '^activities/[0-9a-fA-F-]{36}/' THEN ((storage.foldername(name))[2])::uuid ELSE NULL END)
          AND r.id = (CASE WHEN name ~ '^activities/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/' THEN ((storage.foldername(name))[3])::uuid ELSE NULL END)
          AND (
              (r.status = 'confirmado' AND public.has_permission('atividades.visualizar')) OR
              (r.status = 'pendente' AND r.user_id = auth.uid())
          )
    )
);

-- 7.2. Storage INSERT: Blindada com validação defensiva contra erros de cast
DROP POLICY IF EXISTS "policy_storage_activity_photos_insert" ON storage.objects;
CREATE POLICY "policy_storage_activity_photos_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'activity-photos' AND
    public.has_permission('atividades.fotos.registrar') AND
    name ~ '^activities/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$' AND
    EXISTS (
        SELECT 1 
        FROM public.activity_photo_records r
        JOIN public.activities a ON a.id = r.activity_id
        WHERE a.id = (CASE WHEN name ~ '^activities/[0-9a-fA-F-]{36}/' THEN ((storage.foldername(name))[2])::uuid ELSE NULL END)
          AND r.id = (CASE WHEN name ~ '^activities/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/' THEN ((storage.foldername(name))[3])::uuid ELSE NULL END)
          AND r.user_id = auth.uid()
          AND r.status = 'pendente'
    )
);

-- 7.3. Storage DELETE: Limpeza segura restrita a sessões pendentes
DROP POLICY IF EXISTS "policy_storage_activity_photos_delete" ON storage.objects;
CREATE POLICY "policy_storage_activity_photos_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'activity-photos' AND
    name ~ '^activities/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$' AND
    EXISTS (
        SELECT 1 
        FROM public.activity_photo_records r
        WHERE r.id = (CASE WHEN name ~ '^activities/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/' THEN ((storage.foldername(name))[3])::uuid ELSE NULL END)
          AND r.user_id = auth.uid()
          AND r.status = 'pendente'
    )
);
