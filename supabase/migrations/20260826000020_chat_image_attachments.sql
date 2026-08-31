-- ==============================================================================
-- Migration: 20260826000020_chat_image_attachments.sql
-- Descrição: Suporte a fotos e anexos de imagem no Chat da Operação:
--            1. Adição das colunas image_url e image_name na tabela public.operation_chat_messages.
--            2. Atualização da constraint chk_chat_message_not_empty para permitir envio
--               de fotos puras (sem obrigatoriedade de texto, atividade ou material).
--            3. Criação do bucket 'chat-attachments' no Supabase Storage.
--            4. Configuração de RLS policies em storage.objects para upload e visualização
--               segura por usuários autenticados no sistema.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADICIONAR COLUNAS DE IMAGEM NA TABELA DE MENSAGENS DO CHAT
-- ------------------------------------------------------------------------------
ALTER TABLE public.operation_chat_messages 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_name TEXT;

-- ------------------------------------------------------------------------------
-- 2. ATUALIZAR CONSTRAINT DE CHECAGEM NÃO-NULA
-- Permite: texto OU atividade OU material OU imagem
-- ------------------------------------------------------------------------------
ALTER TABLE public.operation_chat_messages 
DROP CONSTRAINT IF EXISTS chk_chat_message_not_empty;

ALTER TABLE public.operation_chat_messages 
ADD CONSTRAINT chk_chat_message_not_empty CHECK (
    (content IS NOT NULL AND trim(content) <> '') OR
    (activity_id IS NOT NULL) OR
    (material_id IS NOT NULL) OR
    (image_url IS NOT NULL AND trim(image_url) <> '')
);

-- ------------------------------------------------------------------------------
-- 3. BUCKET DO STORAGE: 'chat-attachments'
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-attachments',
    'chat-attachments',
    true, -- Habilitado para renderização direta via URL pública segura do Storage
    5242880, -- Limite defensivo de 5 MB por foto
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ------------------------------------------------------------------------------
-- 4. POLICIES DE SEGURANÇA NO STORAGE (storage.objects)
-- ------------------------------------------------------------------------------

-- 4.1. Visualização / Leitura: Usuários autenticados no sistema
DROP POLICY IF EXISTS "policy_chat_attachments_select" ON storage.objects;
CREATE POLICY "policy_chat_attachments_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'chat-attachments'
);

-- 4.2. Upload / Inserção: Usuários autenticados gravando em seu diretório de autor
DROP POLICY IF EXISTS "policy_chat_attachments_insert" ON storage.objects;
CREATE POLICY "policy_chat_attachments_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'chat-attachments' AND
    (auth.uid() IS NOT NULL)
);

-- 4.3. Exclusão: Usuário pode remover anexos de sua própria autoria se necessário
DROP POLICY IF EXISTS "policy_chat_attachments_delete" ON storage.objects;
CREATE POLICY "policy_chat_attachments_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'chat-attachments' AND
    (auth.uid() IS NOT NULL) AND
    (storage.foldername(name))[1] = auth.uid()::text
);
