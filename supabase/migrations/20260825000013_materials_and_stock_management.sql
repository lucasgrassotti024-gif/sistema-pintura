-- ==============================================================================
-- Migration: 20260825000013_materials_and_stock_management.sql
-- Descrição: Implementa o modelo definitivo de Gestão de Catálogo de Materiais e
--            Entradas de Estoque Rastreáveis (public.stock_movements e RPC atômica).
--
-- Objetivos:
--   1. Permitir cadastro de novos materiais no catálogo (INSERT em public.materials)
--      com saldo inicial estritamente zerado (current_stock = 0.00) protegido por RLS
--      via permissão 'materiais.criar'.
--   2. Criar a tabela imutável public.stock_movements para auditoria e histórico físico.
--   3. Criar a RPC segura public.register_stock_entry com SECURITY DEFINER,
--      SET search_path = public, auth, pg_temp, FOR UPDATE e cálculo atômico de saldos.
--   4. Configurar RLS estrito e GRANTs mínimos essenciais para authenticated.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA: public.stock_movements (Histórico Imutável de Movimentações de Estoque)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    movement_type VARCHAR(30) NOT NULL, -- 'entrada' nesta etapa
    quantity NUMERIC(12,2) NOT NULL,
    previous_stock NUMERIC(12,2) NOT NULL,
    new_stock NUMERIC(12,2) NOT NULL,
    batch VARCHAR(50),                  -- Lote físico da remessa recebida
    expiration_date DATE,               -- Data de validade da remessa
    document_reference VARCHAR(150),    -- Nota Fiscal / Pedido de Compra / Guia
    observation TEXT,                   -- Observações ou notas de recebimento
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints de Integridade Operacional
    CONSTRAINT chk_stock_movement_type CHECK (movement_type IN ('entrada')),
    CONSTRAINT chk_stock_movement_quantity CHECK (quantity > 0.00),
    CONSTRAINT chk_stock_movement_previous_stock CHECK (previous_stock >= 0.00),
    CONSTRAINT chk_stock_movement_new_stock CHECK (new_stock >= 0.00)
);

-- Índices de Performance e Auditoria
CREATE INDEX IF NOT EXISTS idx_stock_movements_material_id ON public.stock_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON public.stock_movements(user_id);

-- ------------------------------------------------------------------------------
-- 2. HABILITAR RLS NA TABELA DE MOVIMENTAÇÕES
-- ------------------------------------------------------------------------------
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. POLICIES E PRIVILÉGIOS (GRANTS)
-- ------------------------------------------------------------------------------

-- Concessão de Privilégios Mínimos Essenciais
GRANT SELECT, INSERT ON public.materials TO authenticated;
GRANT SELECT ON public.stock_movements TO authenticated;

-- RLS: public.materials (INSERT protegido por 'materiais.criar')
DROP POLICY IF EXISTS "policy_materials_insert_authorized" ON public.materials;
CREATE POLICY "policy_materials_insert_authorized"
ON public.materials
FOR INSERT
TO authenticated
WITH CHECK (
    public.has_permission('materiais.criar') AND
    current_stock = 0.00
);

-- RLS: public.stock_movements (SELECT protegido por 'estoque.visualizar' ou 'materiais.visualizar')
DROP POLICY IF EXISTS "policy_stock_movements_select_authorized" ON public.stock_movements;
CREATE POLICY "policy_stock_movements_select_authorized"
ON public.stock_movements
FOR SELECT
TO authenticated
USING (
    public.has_permission('estoque.visualizar') OR
    public.has_permission('materiais.visualizar')
);

-- ------------------------------------------------------------------------------
-- 4. RPC ATÔMICA: public.register_stock_entry
-- Entrada de estoque de material existente com bloqueio FOR UPDATE, registro
-- imutável em stock_movements e atualização segura em public.materials.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_stock_entry(
    p_material_id UUID,
    p_quantity NUMERIC,
    p_batch VARCHAR(50) DEFAULT NULL,
    p_expiration_date DATE DEFAULT NULL,
    p_document_reference VARCHAR(150) DEFAULT NULL,
    p_observation TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_current_stock NUMERIC(12,2);
    v_new_stock NUMERIC(12,2);
    v_movement_id UUID;
    v_material_code VARCHAR(50);
    v_material_name VARCHAR(150);
BEGIN
    -- 1. Validação de Autenticação
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: Usuário não autenticado.';
    END IF;

    -- 2. Validação de Autorização via public.has_permission()
    IF NOT public.has_permission('estoque.movimentar') THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui a permissão estoque.movimentar.';
    END IF;

    -- 3. Validação dos Parâmetros de Entrada
    IF p_material_id IS NULL THEN
        RAISE EXCEPTION 'Parâmetro obrigatório ausente: material_id.';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0.00 THEN
        RAISE EXCEPTION 'Quantidade de entrada inválida. O valor deve ser estritamente maior que zero.';
    END IF;

    -- 4. Bloqueio Concorrencial Atômico (FOR UPDATE) do Material
    SELECT 
        current_stock,
        code,
        name
    INTO 
        v_current_stock,
        v_material_code,
        v_material_name
    FROM public.materials
    WHERE id = p_material_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Material não encontrado no catálogo (ID: %).', p_material_id;
    END IF;

    -- 5. Cálculo dos Saldos Físicos
    v_new_stock := v_current_stock + ROUND(p_quantity::NUMERIC, 2);

    -- 6. Inserção do Registro Imutável na Tabela de Movimentações
    INSERT INTO public.stock_movements (
        material_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        batch,
        expiration_date,
        document_reference,
        observation,
        user_id,
        created_at
    ) VALUES (
        p_material_id,
        'entrada',
        ROUND(p_quantity::NUMERIC, 2),
        v_current_stock,
        v_new_stock,
        NULLIF(TRIM(p_batch), ''),
        p_expiration_date,
        NULLIF(TRIM(p_document_reference), ''),
        NULLIF(TRIM(p_observation), ''),
        v_user_id,
        now()
    )
    RETURNING id INTO v_movement_id;

    -- 7. Atualização Atômica do Saldo Físico em public.materials
    UPDATE public.materials
    SET 
        current_stock = v_new_stock,
        updated_at = now()
    WHERE id = p_material_id;

    -- 8. Retorno Estruturado em Formato JSON
    RETURN jsonb_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'material_id', p_material_id,
        'code', v_material_code,
        'name', v_material_name,
        'quantity_added', ROUND(p_quantity::NUMERIC, 2),
        'previous_stock', v_current_stock,
        'new_stock', v_new_stock,
        'batch', NULLIF(TRIM(p_batch), ''),
        'expiration_date', p_expiration_date,
        'document_reference', NULLIF(TRIM(p_document_reference), '')
    );
END;
$$;

-- Permissão de Execução da RPC para authenticated
GRANT EXECUTE ON FUNCTION public.register_stock_entry TO authenticated;
