import React from "react";
import { ActivityPriority } from "../types/activity.types";

interface ActivityPriorityBadgeProps {
  priority: ActivityPriority;
}

export function ActivityPriorityBadge({ priority }: ActivityPriorityBadgeProps) {
  const priorityConfig: Record<ActivityPriority, { label: string; className: string }> = {
    baixa: {
      label: "Baixa",
      className: "bg-[#070c14] text-slate-400 border-blue-500/15",
    },
    media: {
      label: "Média",
      className: "bg-[#070c14] text-blue-300 border-blue-500/25",
    },
    alta: {
      label: "Alta",
      className: "bg-orange-500/15 text-orange-400 border-orange-500/35",
    },
    urgente: {
      label: "Urgente",
      className: "bg-rose-500/15 text-rose-400 border-rose-500/35 font-semibold shadow-[0_0_10px_-2px_rgba(244,63,94,0.3)]",
    },
  };

  const current = priorityConfig[priority] || {
    label: priority,
    className: "bg-[#070c14] text-slate-400 border-blue-500/15",
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
