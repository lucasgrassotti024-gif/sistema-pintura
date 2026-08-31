import React from "react";
import { ActivityStatus } from "../types/activity.types";

interface ActivityStatusBadgeProps {
  status: ActivityStatus;
}

export function ActivityStatusBadge({ status }: ActivityStatusBadgeProps) {
  const statusConfig: Record<ActivityStatus, { label: string; dotColor: string; className: string }> = {
    programada: {
      label: "Programada",
      dotColor: "bg-slate-400",
      className: "bg-[#090d16] text-slate-300 border-white/10",
    },
    planejada: {
      label: "Planejada",
      dotColor: "bg-slate-400",
      className: "bg-[#090d16] text-slate-300 border-white/10",
    },
    em_andamento: {
      label: "Em Andamento",
      dotColor: "bg-emerald-400",
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-medium",
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
    className: "bg-[#090d16] text-slate-400 border-white/10",
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
