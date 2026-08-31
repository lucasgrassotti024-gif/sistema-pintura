-- ==============================================================================
-- Migration: 20260823000003_hybrid_authorization_model.sql
-- Descrição: Implementa o modelo híbrido de autorização (Cargos + Concessões/Bloqueios)
-- Tabelas criadas:
--   1. public.permissions (Catálogo de permissões)
--   2. public.role_base_permissions (Matriz padrão por cargo)
--   3. public.user_custom_permissions (Overrides: concessões e bloqueios individuais)
-- Função criada:
--   public.has_permission(p_permission TEXT) -> BOOLEAN (via auth.uid() interno)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA: public.permissions (Catálogo de Permissões)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
    id TEXT PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. TABELA: public.role_base_permissions (Matriz Padrão de Permissões por Cargo)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_base_permissions (
    role VARCHAR(50) NOT NULL,
    permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role, permission_id),
    CONSTRAINT chk_base_perm_role CHECK (role IN ('operador', 'inspetor', 'coordenador', 'administrador'))
);

-- ------------------------------------------------------------------------------
-- 3. TABELA: public.user_custom_permissions (Overrides: Concessões e Bloqueios)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_custom_permissions (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    is_granted BOOLEAN NOT NULL, -- TRUE: Concessão (+) | FALSE: Bloqueio (-)
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, permission_id)
);

-- ------------------------------------------------------------------------------
-- 4. ÍNDICES DE PERFORMANCE PARA AUTORIZAÇÃO
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_role_base_permissions_role ON public.role_base_permissions(role);
CREATE INDEX IF NOT EXISTS idx_user_custom_permissions_user ON public.user_custom_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_permissions_user_perm ON public.user_custom_permissions(user_id, permission_id);

-- ------------------------------------------------------------------------------
-- 5. POPULAR CATÁLOGO INICIAL DE PERMISSÕES
-- ------------------------------------------------------------------------------
INSERT INTO public.permissions (id, category, name, description) VALUES
-- Módulo de Atividades
('atividades.visualizar', 'atividades', 'Visualizar Atividades', 'Permite visualizar listas e detalhes das ordens de serviço/atividades.'),
('atividades.criar', 'atividades', 'Criar Atividades', 'Permite cadastrar novas ordens de serviço de pintura.'),
('atividades.editar', 'atividades', 'Editar Atividades', 'Permite editar informações cadastrais das atividades.'),
('atividades.reprogramar', 'atividades', 'Reprogramar Atividades', 'Permite revisar datas de cronograma e escopo com justificativa obrigatória.'),
('atividades.cancelar', 'atividades', 'Cancelar Atividades', 'Permite cancelar ordens de serviço com justificativa obrigatória.'),
('atividades.atualizar_progresso', 'atividades', 'Atualizar Progresso', 'Permite apontar avanço físico percentual em campo.'),
('atividades.registrar_consumo', 'atividades', 'Registrar Consumo Real', 'Permite apontar insumos e tintas consumidas na atividade.'),

-- Módulo de Materiais
('materiais.visualizar', 'materiais', 'Visualizar Catálogo de Materiais', 'Permite consultar o catálogo de tintas e insumos.'),
('materiais.criar', 'materiais', 'Cadastrar Materiais', 'Permite adicionar novos materiais ao catálogo.'),
('materiais.editar', 'materiais', 'Editar Materiais', 'Permite alterar especificações técnicas e estoque mínimo do material.'),

-- Módulo de Estoque
('estoque.visualizar', 'estoque', 'Visualizar Saldos de Estoque', 'Permite consultar posições físicas de estoque e almoxarifado.'),
('estoque.movimentar', 'estoque', 'Movimentar Estoque', 'Permite registrar entradas manuais, perdas e ajustes de inventário.'),

-- Visões e Módulos Gerais
('dashboard.visualizar', 'sistema', 'Visualizar Dashboard', 'Permite acessar o painel de indicadores operacionais e exceções.'),
('historico.visualizar', 'sistema', 'Visualizar Histórico', 'Permite acessar o histórico de frentes concluídas e canceladas.'),
('notificacoes.visualizar', 'sistema', 'Visualizar Notificações', 'Permite acessar a central de notificações operacionais.'),

-- Gestão de Usuários e Permissões
('usuarios.visualizar', 'usuarios', 'Visualizar Usuários', 'Permite consultar a listagem de usuários e perfis operacionais.'),
('usuarios.gerenciar', 'usuarios', 'Gerenciar Usuários e Permissões', 'Permite alterar cargos, conceder ou bloquear permissões individuais.')
ON CONFLICT (id) DO UPDATE 
SET 
    category = EXCLUDED.category,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- ------------------------------------------------------------------------------
-- 6. POPULAR MATRIZ PADRÃO POR CARGO (role_base_permissions)
-- ------------------------------------------------------------------------------

-- OPERADOR
INSERT INTO public.role_base_permissions (role, permission_id) VALUES
('operador', 'atividades.visualizar'),
('operador', 'atividades.atualizar_progresso'),
('operador', 'atividades.registrar_consumo'),
('operador', 'materiais.visualizar'),
('operador', 'estoque.visualizar'),
('operador', 'dashboard.visualizar'),
('operador', 'historico.visualizar'),
('operador', 'notificacoes.visualizar')
ON CONFLICT (role, permission_id) DO NOTHING;

-- INSPETOR
INSERT INTO public.role_base_permissions (role, permission_id) VALUES
('inspetor', 'atividades.visualizar'),
('inspetor', 'atividades.atualizar_progresso'),
('inspetor', 'materiais.visualizar'),
('inspetor', 'estoque.visualizar'),
('inspetor', 'dashboard.visualizar'),
('inspetor', 'historico.visualizar'),
('inspetor', 'notificacoes.visualizar')
ON CONFLICT (role, permission_id) DO NOTHING;

-- COORDENADOR
INSERT INTO public.role_base_permissions (role, permission_id) VALUES
('coordenador', 'atividades.visualizar'),
('coordenador', 'atividades.criar'),
('coordenador', 'atividades.editar'),
('coordenador', 'atividades.reprogramar'),
('coordenador', 'atividades.cancelar'),
('coordenador', 'atividades.atualizar_progresso'),
('coordenador', 'atividades.registrar_consumo'),
('coordenador', 'materiais.visualizar'),
('coordenador', 'materiais.criar'),
('coordenador', 'materiais.editar'),
('coordenador', 'estoque.visualizar'),
('coordenador', 'estoque.movimentar'),
('coordenador', 'dashboard.visualizar'),
('coordenador', 'historico.visualizar'),
('coordenador', 'notificacoes.visualizar'),
('coordenador', 'usuarios.visualizar')
ON CONFLICT (role, permission_id) DO NOTHING;

-- ADMINISTRADOR (Todas as permissões do sistema)
INSERT INTO public.role_base_permissions (role, permission_id) VALUES
('administrador', 'atividades.visualizar'),
('administrador', 'atividades.criar'),
('administrador', 'atividades.editar'),
('administrador', 'atividades.reprogramar'),
('administrador', 'atividades.cancelar'),
('administrador', 'atividades.atualizar_progresso'),
('administrador', 'atividades.registrar_consumo'),
('administrador', 'materiais.visualizar'),
('administrador', 'materiais.criar'),
('administrador', 'materiais.editar'),
('administrador', 'estoque.visualizar'),
('administrador', 'estoque.movimentar'),
('administrador', 'dashboard.visualizar'),
('administrador', 'historico.visualizar'),
('administrador', 'notificacoes.visualizar'),
('administrador', 'usuarios.visualizar'),
('administrador', 'usuarios.gerenciar')
ON CONFLICT (role, permission_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. FUNÇÃO DE AUTORIZAÇÃO: public.has_permission(p_permission TEXT)
-- Utiliza estritamente auth.uid() interno e validação com NOT EXISTS para bloqueios
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    WITH current_user_record AS (
      -- 1. Verifica se o usuário autenticado existe e está ativo
      SELECT role 
      FROM public.users 
      WHERE id = auth.uid() AND active = true
    ),
    -- 2. Permissões padrão herdadas do cargo
    base_permissions AS (
      SELECT rbp.permission_id
      FROM public.role_base_permissions rbp
      JOIN current_user_record cur ON cur.role = rbp.role
    ),
    -- 3. Overrides individuais cadastrados (concessões e bloqueios)
    custom_permissions AS (
      SELECT ucp.permission_id, ucp.is_granted
      FROM public.user_custom_permissions ucp
      WHERE ucp.user_id = auth.uid()
    )
    -- 4. Resolução da permissão efetiva:
    SELECT 1 FROM (
      -- Base do Cargo + Concessões Individuais (is_granted = true)
      SELECT permission_id FROM base_permissions
      UNION
      SELECT permission_id FROM custom_permissions WHERE is_granted = true
    ) effective_permissions
    WHERE effective_permissions.permission_id = p_permission
      -- Subtrai qualquer Bloqueio Individual Explícito usando NOT EXISTS
      AND NOT EXISTS (
        SELECT 1 
        FROM custom_permissions cp_block 
        WHERE cp_block.permission_id = effective_permissions.permission_id 
          AND cp_block.is_granted = false
      )
  );
$$;
