"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "operador" | "inspetor" | "coordenador" | "administrador" | "desenvolvedor";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  permissions: Set<string>;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  signOut: () => Promise<void>;
  refreshProfileAndPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Instância singleton do cliente Supabase para o Browser
  const supabase = useMemo(() => createClient(), []);

  /**
   * Carrega o perfil operacional em public.users e resolve as permissões
   * diretamente a partir do banco de dados (role_base_permissions + user_custom_permissions).
   */
  const loadProfileAndPermissions = useCallback(
    async (currentUser: User | null) => {
      if (!currentUser) {
        setProfile(null);
        setPermissions(new Set());
        return;
      }

      try {
        // Verificar sessão ativa e inspecionar claims do JWT
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const session = sessionData?.session;
        let jwtRole: string | null = null;

        if (session?.access_token) {
          try {
            // Decodifica a carga útil do JWT de forma segura (sem expor o token)
            const parts = session.access_token.split(".");
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              jwtRole = payload.role || payload.aud || null;
            }
          } catch {
            jwtRole = "erro_ao_decodificar";
          }
        }

        console.log("[AuthContext Diagnostic] SESSÃO E CLIENTE SUPABASE:", {
          clienteUtilizado: "createBrowserClient (@supabase/ssr)",
          hasSession: !!session,
          sessionId: session?.user?.id || null,
          sessionEmail: session?.user?.email || null,
          sessionUserRole: session?.user?.role || null, // role do objeto auth
          hasAccessToken: !!session?.access_token,
          jwtClaimRole: jwtRole, // claim 'role' do token enviado ao PostgREST (deve ser 'authenticated')
          sessionError: sessionError ? sessionError.message : null,
          currentUserPassedId: currentUser.id,
          currentUserPassedEmail: currentUser.email,
        });

        // 1. Buscar perfil operacional em public.users
        console.log("[AuthContext Diagnostic] Executando SELECT em public.users para id:", currentUser.id);
        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("id", currentUser.id)
          .single();

        console.log("[AuthContext Diagnostic] RESULTADO public.users:", {
          profileData,
          errorCode: profileError?.code || null,
          errorMessage: profileError?.message || null,
          errorDetails: profileError?.details || null,
          errorHint: profileError?.hint || null,
        });

        if (profileError || !profileData) {
          console.error("[AuthContext Diagnostic] Falha ao carregar perfil em public.users:", profileError?.message || "Sem dados");
          setProfile(null);
          setPermissions(new Set());
          return;
        }

        const formattedProfile: UserProfile = {
          id: profileData.id,
          fullName: profileData.full_name,
          email: profileData.email,
          role: profileData.role as UserRole,
          active: profileData.active,
          createdAt: profileData.created_at,
          updatedAt: profileData.updated_at,
        };
        setProfile(formattedProfile);

        if (!formattedProfile.active) {
          console.warn("[AuthContext Diagnostic] Usuário está inativo no sistema.");
          setPermissions(new Set());
          return;
        }

        // 2. Buscar permissões base do cargo em public.role_base_permissions
        console.log("[AuthContext Diagnostic] Executando SELECT em role_base_permissions para role:", formattedProfile.role);
        const { data: basePermsData, error: baseError } = await supabase
          .from("role_base_permissions")
          .select("permission_id")
          .eq("role", formattedProfile.role);

        console.log("[AuthContext Diagnostic] RESULTADO role_base_permissions:", {
          totalBasePerms: basePermsData ? basePermsData.length : 0,
          basePermsData,
          errorCode: baseError?.code || null,
          errorMessage: baseError?.message || null,
          errorDetails: baseError?.details || null,
          errorHint: baseError?.hint || null,
        });

        const baseSet = new Set<string>((basePermsData || []).map((p) => p.permission_id));

        // 3. Buscar exceções individuais (concessões e bloqueios) em public.user_custom_permissions
        console.log("[AuthContext Diagnostic] Executando SELECT em user_custom_permissions para user_id:", currentUser.id);
        const { data: customPermsData, error: customError } = await supabase
          .from("user_custom_permissions")
          .select("permission_id, is_granted")
          .eq("user_id", currentUser.id);

        console.log("[AuthContext Diagnostic] RESULTADO user_custom_permissions:", {
          totalCustomPerms: customPermsData ? customPermsData.length : 0,
          customPermsData,
          errorCode: customError?.code || null,
          errorMessage: customError?.message || null,
          errorDetails: customError?.details || null,
          errorHint: customError?.hint || null,
        });

        // 4. Calcular conjunto efetivo: (Base + Concessões) - Bloqueios
        const grantedSet = new Set<string>();
        const blockedSet = new Set<string>();

        (customPermsData || []).forEach((cp) => {
          if (cp.is_granted) {
            grantedSet.add(cp.permission_id);
          } else {
            blockedSet.add(cp.permission_id);
          }
        });

        const effective = new Set<string>();

        // Inclui as base que não estão bloqueadas
        baseSet.forEach((perm) => {
          if (!blockedSet.has(perm)) {
            effective.add(perm);
          }
        });

        // Inclui as concedidas que não estão bloqueadas
        grantedSet.forEach((perm) => {
          if (!blockedSet.has(perm)) {
            effective.add(perm);
          }
        });

        console.log("[AuthContext Diagnostic] Conjunto final de permissões efetivas calculadas:", {
          total: effective.size,
          permissoes: Array.from(effective),
          temAtividadesCriar: effective.has("atividades.criar"),
        });

        setPermissions(effective);
      } catch (err) {
        console.error("Erro ao carregar perfil e permissões do usuário:", err);
      }
    },
    [supabase]
  );

  useEffect(() => {
    let isMounted = true;

    // 1. Obter usuário autenticado inicial
    const initAuth = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (isMounted) {
          setUser(currentUser);
          await loadProfileAndPermissions(currentUser);
        }
      } catch (err) {
        console.error("Erro ao verificar autenticação inicial:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // 2. Monitorar eventos de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (isMounted) {
        setUser(currentUser);
        await loadProfileAndPermissions(currentUser);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadProfileAndPermissions]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setPermissions(new Set());
      window.location.href = "/login";
    } catch (err) {
      console.error("Erro ao realizar logout:", err);
    }
  };

  const hasPermission = useCallback(
    (permission: string): boolean => {
      return permissions.has(permission);
    },
    [permissions]
  );

  const refreshProfileAndPermissions = async () => {
    await loadProfileAndPermissions(user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        permissions,
        isLoading,
        hasPermission,
        signOut,
        refreshProfileAndPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider");
  }
  return context;
}
