-- ==============================================================================
-- Migration: 20260831000021_ia_chat_conversations_persistence.sql
-- Descrição: Implementa a infraestrutura de persistência de conversas e mensagens
--            do Assistente de Inteligência Operacional (/pintura/ia), com isolamento
--            estrito de RLS por usuário autenticado e ordenação cronológica.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE CONVERSAS DA IA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ia_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Conversa com Assistente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para busca rápida de conversas recentes por usuário
CREATE INDEX IF NOT EXISTS idx_ia_conversations_user_updated 
ON public.ia_conversations (user_id, updated_at DESC);

-- ------------------------------------------------------------------------------
-- 2. TABELA DE MENSAGENS DA IA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ia_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.ia_conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'ia')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para ordenação cronológica das mensagens por conversa
CREATE INDEX IF NOT EXISTS idx_ia_messages_conversation_created 
ON public.ia_messages (conversation_id, created_at ASC);

-- ------------------------------------------------------------------------------
-- 3. HABILITAÇÃO E POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------

-- RLS: Conversas
ALTER TABLE public.ia_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ia_conversations_select_own" ON public.ia_conversations;
CREATE POLICY "ia_conversations_select_own"
ON public.ia_conversations
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "ia_conversations_insert_own" ON public.ia_conversations;
CREATE POLICY "ia_conversations_insert_own"
ON public.ia_conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "ia_conversations_update_own" ON public.ia_conversations;
CREATE POLICY "ia_conversations_update_own"
ON public.ia_conversations
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "ia_conversations_delete_own" ON public.ia_conversations;
CREATE POLICY "ia_conversations_delete_own"
ON public.ia_conversations
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- RLS: Mensagens
ALTER TABLE public.ia_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ia_messages_select_own" ON public.ia_messages;
CREATE POLICY "ia_messages_select_own"
ON public.ia_messages
FOR SELECT
TO authenticated
USING (
    auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ia_conversations c 
        WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "ia_messages_insert_own" ON public.ia_messages;
CREATE POLICY "ia_messages_insert_own"
ON public.ia_messages
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ia_conversations c 
        WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "ia_messages_update_own" ON public.ia_messages;
CREATE POLICY "ia_messages_update_own"
ON public.ia_messages
FOR UPDATE
TO authenticated
USING (
    auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ia_conversations c 
        WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ia_conversations c 
        WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "ia_messages_delete_own" ON public.ia_messages;
CREATE POLICY "ia_messages_delete_own"
ON public.ia_messages
FOR DELETE
TO authenticated
USING (
    auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ia_conversations c 
        WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 4. PERMISSÕES DE ACESSO (GRANTS)
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_messages TO authenticated;
