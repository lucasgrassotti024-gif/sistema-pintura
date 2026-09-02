import React from "react";
import { ActivityPriority } from "../types/activity.types";

interface ActivityPriorityBadgeProps {
  priority: ActivityPriority;
}

export function ActivityPriorityBadge({ priority }: ActivityPriorityBadgeProps) {
  switch (priority) {
    case "alta":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-[#070c14] text-rose-400 border border-rose-500/30 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          Prioridade Alta
        </span>
      );

    case "media":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-[#070c14] text-amber-400 border border-amber-500/30 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Prioridade Média
        </span>
      );

    case "baixa":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-[#070c14] text-blue-400 border border-blue-500/30 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Prioridade Baixa
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-[#070c14] text-slate-400 border border-slate-700 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          {priority}
        </span>
      );
  }
}
