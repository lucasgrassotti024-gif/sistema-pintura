import React from "react";
import { ActivityStatus } from "../types/activity.types";

interface ActivityStatusBadgeProps {
  status: ActivityStatus;
}

export function ActivityStatusBadge({ status }: ActivityStatusBadgeProps) {
  const statusConfig: Record<ActivityStatus, { label: string; dotColor: string; className: string }> = {
    programada: {
      label: "Programada",
      dotColor: "bg-blue-400",
      className: "bg-[#070c14] text-blue-300 border-blue-500/25",
    },
    planejada: {
      label: "Planejada",
      dotColor: "bg-blue-400",
      className: "bg-[#070c14] text-blue-300 border-blue-500/25",
    },
    em_andamento: {
      label: "Em Andamento",
      dotColor: "bg-orange-500",
      className: "bg-orange-500/15 text-orange-400 border-orange-500/35 font-medium shadow-[0_0_10px_-2px_rgba(249,115,22,0.3)]",
    },
    pausada: {
      label: "Pausada",
      dotColor: "bg-amber-400",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    concluida: {
      label: "Concluída",
      dotColor: "bg-emerald-400",
      className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-medium",
    },
    cancelada: {
      label: "Cancelada",
      dotColor: "bg-rose-400",
      className: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    },
  };

  const current = statusConfig[status] || {
    label: status,
    dotColor: "bg-slate-400",
    className: "bg-[#070c14] text-slate-400 border-blue-500/15",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider border select-none cursor-default ${current.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dotColor}`} />
      {current.label}
    </span>
  );
}
