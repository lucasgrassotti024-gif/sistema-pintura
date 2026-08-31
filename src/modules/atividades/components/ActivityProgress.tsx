import React from "react";

interface ActivityProgressProps {
  currentProgress: number;
  onUpdateProgress?: (progress: number) => void;
}

export function ActivityProgress({ currentProgress }: ActivityProgressProps) {
  const isComplete = currentProgress >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-400 font-mono">Progresso</span>
        <span className={`font-mono font-bold ${isComplete ? "text-emerald-400" : "text-slate-200"}`}>
          {currentProgress}%
        </span>
      </div>
      <div className="w-full bg-slate-900 border border-white/5 rounded-full h-2 p-0.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete
              ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
              : "bg-emerald-400/80 shadow-[0_0_6px_rgba(16,185,129,0.4)]"
          }`}
          style={{ width: `${Math.min(Math.max(currentProgress, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
