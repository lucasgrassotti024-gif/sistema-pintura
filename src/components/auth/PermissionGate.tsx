"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";

interface PermissionGateProps {
  permission: string | string[];
  requireAll?: boolean; // Se true, exige todas as permissões listadas; se false (padrão), exige pelo menos uma
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Componente declarativo para controlar a visibilidade de elementos baseado em permissões do banco.
 *
 * Exemplo de uso:
 * <PermissionGate permission="atividades.criar">
 *   <button>+ Adicionar Atividade</button>
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { hasPermission, isLoading, permissions, role } = useAuth();

  const perms = Array.isArray(permission) ? permission : [permission];

  const isAuthorized = requireAll
    ? perms.every((p) => hasPermission(p))
    : perms.some((p) => hasPermission(p));

  if (isLoading) {
    console.log("[PermissionGate Diagnostic] Bloqueado temporariamente por isLoading = true para:", perms);
    return null;
  }

  console.log("[PermissionGate Diagnostic] Avaliação:", {
    permissoesTestadas: perms,
    roleAtual: role,
    totalPermissoesNoSet: permissions.size,
    isAuthorized,
  });

  if (!isAuthorized) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
