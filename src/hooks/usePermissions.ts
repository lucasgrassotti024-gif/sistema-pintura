"use client";

import { useAuth } from "@/context/AuthContext";

/**
 * Hook reutilizável de autorização para consulta de permissões no frontend.
 */
export function usePermissions() {
  const { hasPermission, permissions, role, profile, isLoading } = useAuth();

  return {
    hasPermission,
    permissions,
    role,
    profile,
    isLoading,
    // Helpers semânticos frequentes
    canViewActivities: hasPermission("atividades.visualizar"),
    canCreateActivities: hasPermission("atividades.criar"),
    canEditActivities: hasPermission("atividades.editar"),
    canRescheduleActivities: hasPermission("atividades.reprogramar"),
    canCancelActivities: hasPermission("atividades.cancelar"),
    canArchiveActivities: hasPermission("atividades.arquivar"),
    canUpdateProgress: hasPermission("atividades.atualizar_progresso"),
    canRegisterConsumption: hasPermission("atividades.registrar_consumo"),
    canViewMaterials: hasPermission("materiais.visualizar"),
    canManageMaterials: hasPermission("materiais.editar"),
    canMoveStock: hasPermission("estoque.movimentar"),
    canManageUsers: hasPermission("usuarios.gerenciar"),
  };
}
