-- ==============================================================================
-- Migration: 20260826000019_fix_operation_chat_grants.sql
-- Descrição: Concede privilégios tabulares (GRANTs) essenciais para a role
--            'authenticated' na tabela public.operation_chat_messages,
--            permitindo a avaliação correta das políticas de RLS no PostgreSQL.
--
-- Regras de Segurança:
--   1. GRANTs concedidos estritamente para a role 'authenticated':
--      - SELECT: Leitura de mensagens (filtrada pela policy RLS).
--      - INSERT: Envio de mensagens (filtrada pela policy RLS user_id = auth.uid()).
--      - DELETE: Exclusão de mensagens (filtrada pela policy RLS user_id = auth.uid()).
--   2. Role 'anon' permanece sem qualquer privilégio.
--   3. Row Level Security (RLS) permanece 100% ativo e inalterado.
-- ==============================================================================

-- 1. Assegurar privilégio de uso no schema public
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Concessão de Privilégios Tabulares (GRANTs) para usuários autenticados
GRANT SELECT, INSERT, DELETE ON public.operation_chat_messages TO authenticated;
