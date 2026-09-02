import React from "react";
import { ActivityPriority } from "../types/activity.types";

interface ActivityPriorityBadgeProps {
  priority: ActivityPriority;
}

export function ActivityPriorityBadge({ priority }: ActivityPriorityBadgeProps) {
  switch (priority) {
    case "alta":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Prioridade Alta
        </span>
      );

    case "media":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Prioridade Média
        </span>
      );

    case "baixa":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Prioridade Baixa
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          {priority}
        </span>
      );
  }
}
