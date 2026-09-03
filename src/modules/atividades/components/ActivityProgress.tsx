import React from "react";

interface ActivityProgressProps {
  currentProgress: number;
}

export function ActivityProgress({ currentProgress }: ActivityProgressProps) {
  const isFull = currentProgress === 100;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="font-mono text-slate-400 text-[11px] uppercase tracking-wider">
          Avanço Físico
        </span>
        <span
          className={`font-mono font-bold ${
            isFull ? "text-emerald-400" : "text-orange-400"
          }`}
        >
          {currentProgress}%
        </span>
      </div>

      {/* Barra de Progresso com Laranja RSS3 / Verde em 100% */}
      <div className="w-full bg-[var(--bg-base)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isFull ? "bg-emerald-500" : "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"
          }`}
          style={{ width: `${Math.min(Math.max(currentProgress, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
