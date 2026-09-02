import React from "react";

interface ActivityProgressProps {
  currentProgress: number;
}

export function ActivityProgress({ currentProgress }: ActivityProgressProps) {
  const isFull = currentProgress === 100;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="font-mono text-slate-500 text-[11px] uppercase tracking-wider">
          Avanço Físico
        </span>
        <span
          className={`font-mono font-bold ${
            isFull ? "text-emerald-600" : "text-blue-600"
          }`}
        >
          {currentProgress}%
        </span>
      </div>

      {/* Barra de Progresso Clara com Laranja RSS3 / Verde em 100% */}
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isFull ? "bg-emerald-600" : "bg-blue-600"
          }`}
          style={{ width: `${Math.min(Math.max(currentProgress, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
