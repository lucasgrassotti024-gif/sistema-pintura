import React from "react";
import { ActivityPriority } from "../types/activity.types";

interface ActivityPriorityBadgeProps {
  priority: ActivityPriority;
}

export function ActivityPriorityBadge({ priority }: ActivityPriorityBadgeProps) {
  const priorityConfig: Record<ActivityPriority, { label: string; className: string }> = {
    baixa: {
      label: "Baixa",
      className: "bg-[#090d16] text-slate-400 border-white/5",
    },
    media: {
      label: "Média",
      className: "bg-[#090d16] text-slate-300 border-white/10",
    },
    alta: {
      label: "Alta",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    urgente: {
      label: "Urgente",
      className: "bg-rose-500/10 text-rose-400 border-rose-500/30 font-medium",
    },
  };

  const current = priorityConfig[priority] || {
    label: priority,
    className: "bg-[#090d16] text-slate-400 border-white/5",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider border select-none cursor-default ${current.className}`}
    >
      <span className="text-[9px] text-slate-400 mr-1 font-normal lowercase">prioridade:</span>
      {current.label}
    </span>
  );
}
