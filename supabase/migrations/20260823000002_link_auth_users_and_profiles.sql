-- ==============================================================================
-- Migration: 20260823000002_link_auth_users_and_profiles.sql
-- Descrição: Vincula public.users.id diretamente a auth.users(id) (1:1),
--            adiciona updated_at, cria a função trigger segura com SECURITY DEFINER
--            e search_path explícito, fixa o role inicial em 'operador' (sem confiar
--            em metadados de privilégios) e sincroniza usuários pré-existentes.
-- ==============================================================================

-- 1. Adicionar updated_at em public.users (caso não exista)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Adaptar public.users para que id seja FK de auth.users(id) com ON DELETE CASCADE
-- Remove o default uuid_generate_v4() pois o ID agora é fornecido estritamente pelo auth.users
ALTER TABLE public.users 
ALTER COLUMN id DROP DEFAULT;

-- Adiciona a constraint de Foreign Key para auth.users (caso ainda não exista)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_public_users_auth_users'
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT fk_public_users_auth_users
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Função Trigger segura para criação automática do perfil operacional
-- Regra de Segurança: 'role' nasce OBRIGATORIAMENTE como 'operador', nunca aceita privilégios do cliente.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    INSERT INTO public.users (
        id, 
        full_name, 
        email, 
        role, 
        active, 
        created_at, 
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
            split_part(NEW.email, '@', 1)
        ),
        NEW.email,
        'operador', -- Segurança: Todo usuário nasce obrigatoriamente como 'operador'
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE 
    SET 
        email = EXCLUDED.email,
        updated_at = now();

    RETURN NEW;
END;
$$;

-- 4. Criar o Trigger no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Sincronização inicial: garantir que qualquer usuário já existente em auth.users
-- receba seu respectivo perfil em public.users sem duplicação ou perda de dados
INSERT INTO public.users (id, full_name, email, role, active, created_at, updated_at)
SELECT 
    au.id,
    COALESCE(
        NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
        split_part(au.email, '@', 1)
    ),
    au.email,
    'operador',
    true,
    COALESCE(au.created_at, now()),
    now()
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;
