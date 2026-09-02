import React from "react";
import { ActivityStatus } from "../types/activity.types";

interface ActivityStatusBadgeProps {
  status: ActivityStatus;
}

export function ActivityStatusBadge({ status }: ActivityStatusBadgeProps) {
  switch (status) {
    case "programada":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-[#070c14] text-blue-400 border border-blue-500/30 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Programada
        </span>
      );

    case "planejada":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-[#070c14] text-blue-300 border border-blue-500/30 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Planejada
        </span>
      );

    case "em_andamento":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold uppercase tracking-wider bg-[#070c14] text-orange-400 border border-orange-500/40 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
          Em Andamento
        </span>
      );

    case "pausada":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-[#070c14] text-amber-400 border border-amber-500/30 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Pausada
        </span>
      );

    case "concluida":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold uppercase tracking-wider bg-[#070c14] text-emerald-400 border border-emerald-500/30 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Concluída
        </span>
      );

    case "cancelada":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wider bg-[#070c14] text-rose-400 border border-rose-500/30 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          Cancelada
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-[#070c14] text-slate-400 border border-slate-700 select-none cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          {status}
        </span>
      );
  }
}
