-- ==============================================================================
-- Migration: 20260825000017_enable_supabase_realtime.sql
-- Descrição: Habilita publicação em tempo real (Supabase Realtime) para as
--            tabelas operacionais essenciais do Sistema de Pintura:
--            1. public.activities
--            2. public.materials
--            3. public.stock_movements
--            4. public.notifications
--            5. public.notification_reads
--            6. public.activity_audit_logs
--            7. public.activity_consumptions
--
-- Regras de Segurança:
--   1. Todas as tabelas continuam com Row Level Security (RLS) estritamente ativo.
--   2. O Supabase Realtime respeita nativamente as policies de SELECT existentes.
-- ==============================================================================

-- 1. Habilitar Realtime na publicação padrão do Supabase
DO $$
BEGIN
    -- activities
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activities'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
    END IF;

    -- materials
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'materials'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
    END IF;

    -- stock_movements
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stock_movements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
    END IF;

    -- notifications
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;

    -- notification_reads
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notification_reads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_reads;
    END IF;

    -- activity_audit_logs
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activity_audit_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_audit_logs;
    END IF;

    -- activity_consumptions
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activity_consumptions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_consumptions;
    END IF;
END $$;
