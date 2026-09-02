import React from "react";
import { ActivityStatus } from "../types/activity.types";

interface ActivityStatusBadgeProps {
  status: ActivityStatus;
}

export function ActivityStatusBadge({ status }: ActivityStatusBadgeProps) {
  switch (status) {
    case "programada":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Programada
        </span>
      );

    case "planejada":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Planejada
        </span>
      );

    case "em_andamento":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          Em Andamento
        </span>
      );

    case "pausada":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Pausada
        </span>
      );

    case "concluida":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          Concluída
        </span>
      );

    case "cancelada":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Cancelada
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          {status}
        </span>
      );
  }
}
