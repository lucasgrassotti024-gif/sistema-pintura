import React from "react";
import { ActivityPriority } from "../types/activity.types";

interface ActivityPriorityBadgeProps {
  priority: ActivityPriority;
}

export function ActivityPriorityBadge({ priority }: ActivityPriorityBadgeProps) {
  switch (priority) {
    case "alta":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Prioridade Alta
        </span>
      );

    case "media":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Prioridade Média
        </span>
      );

    case "baixa":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Prioridade Baixa
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          {priority}
        </span>
      );
  }
}
