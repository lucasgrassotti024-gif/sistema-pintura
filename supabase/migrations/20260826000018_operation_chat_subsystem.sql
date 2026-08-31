-- ==============================================================================
-- Migration: 20260826000018_operation_chat_subsystem.sql
-- Descrição: Implementa a infraestrutura do Chat Colaborativo da Operação
--            (Fase 1: Sala Única "Chat da Operação") com mensagens em tempo real,
--            suporte a vínculos estruturados de Atividades e Materiais,
--            isolamento rigoroso de RLS e preservação histórica de integridade.
--
-- Objetivos:
--   1. Criar a tabela public.operation_chat_messages.
--   2. Implementar RLS estrito:
--      - SELECT: Usuários autenticados (auth.uid() IS NOT NULL).
--      - INSERT: Usuários autenticados onde user_id = auth.uid().
--      - DELETE: Usuários autenticados onde user_id = auth.uid() (excluir apenas a própria mensagem).
--   3. Configurar ON DELETE SET NULL para activity_id e material_id para que
--      exclusões definitivas preservem a mensagem textual no chat com fallback visual.
--   4. Adicionar public.operation_chat_messages à publicação supabase_realtime.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE MENSAGENS DO CHAT OPERACIONAL
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operation_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT,
    activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
    material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_chat_message_not_empty CHECK (
        (content IS NOT NULL AND trim(content) <> '') OR
        (activity_id IS NOT NULL) OR
        (material_id IS NOT NULL)
    )
);

-- Índices de Consulta e Ordenação
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
ON public.operation_chat_messages (created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_activity_id 
ON public.operation_chat_messages (activity_id) 
WHERE activity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_material_id 
ON public.operation_chat_messages (material_id) 
WHERE material_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.operation_chat_messages ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: Qualquer usuário autenticado no sistema
DROP POLICY IF EXISTS "chat_messages_select_authenticated" ON public.operation_chat_messages;
CREATE POLICY "chat_messages_select_authenticated"
ON public.operation_chat_messages
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Política de Inserção: Usuário autenticado inserindo em seu próprio nome
DROP POLICY IF EXISTS "chat_messages_insert_own" ON public.operation_chat_messages;
CREATE POLICY "chat_messages_insert_own"
ON public.operation_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Política de Exclusão: Usuário autenticado só pode deletar sua própria mensagem
DROP POLICY IF EXISTS "chat_messages_delete_own" ON public.operation_chat_messages;
CREATE POLICY "chat_messages_delete_own"
ON public.operation_chat_messages
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 3. HABILITAR SUPABASE REALTIME
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'operation_chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_chat_messages;
    END IF;
END $$;
