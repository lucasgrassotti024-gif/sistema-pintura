"use client";

import React from "react";
import { AttachedActivityData, AttachedMaterialData } from "../types/chat.types";
import { ActivityStatusBadge } from "@/modules/atividades/components/ActivityStatusBadge";

interface ActivityCardProps {
  activity?: AttachedActivityData | null;
  isDeleted?: boolean;
  onOpenDetails?: (activityId: string) => void;
}

export function ActivityAttachmentCard({ activity, isDeleted, onOpenDetails }: ActivityCardProps) {
  if (isDeleted || !activity) {
    return (
      <div className="mt-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
        <span>⚠️</span>
        <span>Atividade excluída definitivamente do sistema.</span>
      </div>
    );
  }

  return (
    <div className="mt-2 p-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-medium)] hover:border-emerald-500/50 transition-colors shadow-sm max-w-md">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {activity.orderNumber}
          </span>
          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
            {activity.name}
          </span>
        </div>
        <ActivityStatusBadge status={activity.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[var(--text-secondary)] my-2 pt-2 border-t border-[var(--border-subtle)]">
        <div>
          <span className="text-[var(--text-muted)]">Progresso: </span>
          <span className="text-[var(--text-primary)] font-bold">{activity.progressPercentage}%</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Prazo: </span>
          <span className="text-[var(--text-primary)]">{activity.plannedEndDate}</span>
        </div>
        <div className="col-span-2 truncate">
          <span className="text-[var(--text-muted)]">Área: </span>
          <span className="text-[var(--text-primary)]">{activity.areaName || "—"}</span>
        </div>
      </div>

      {onOpenDetails && (
        <button
          type="button"
          onClick={() => onOpenDetails(activity.id)}
          className="w-full mt-1 py-1 px-2.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded transition-colors text-center cursor-pointer"
        >
          Ver Detalhes da Atividade →
        </button>
      )}
    </div>
  );
}

interface MaterialCardProps {
  material?: AttachedMaterialData | null;
  isDeleted?: boolean;
  onOpenDetails?: (materialId: string) => void;
}

export function MaterialAttachmentCard({ material, isDeleted, onOpenDetails }: MaterialCardProps) {
  if (isDeleted || !material) {
    return (
      <div className="mt-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-mono flex items-center gap-2">
        <span>⚠️</span>
        <span>Material inativado ou removido do catálogo.</span>
      </div>
    );
  }

  return (
    <div className="mt-2 p-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-medium)] hover:border-emerald-500/50 transition-colors shadow-sm max-w-md">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {material.code}
          </span>
          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
            {material.name}
          </span>
        </div>
        <span
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
            material.status === "critico"
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
              : material.status === "atencao"
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
          }`}
        >
          ● {material.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[var(--text-secondary)] my-2 pt-2 border-t border-[var(--border-subtle)]">
        <div>
          <span className="text-[var(--text-muted)]">Saldo Atual: </span>
          <span className="text-[var(--text-primary)] font-bold">
            {material.currentStock} {material.unit}
          </span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Estoque Mínimo: </span>
          <span className="text-[var(--text-primary)]">
            {material.minimumStock} {material.unit}
          </span>
        </div>
        <div className="col-span-2 truncate">
          <span className="text-[var(--text-muted)]">Tipo: </span>
          <span className="text-[var(--text-primary)]">{material.type}</span>
        </div>
      </div>

      {onOpenDetails && (
        <button
          type="button"
          onClick={() => onOpenDetails(material.id)}
          className="w-full mt-1 py-1 px-2.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded transition-colors text-center cursor-pointer"
        >
          Ver Registro no Estoque →
        </button>
      )}
    </div>
  );
}
