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
        <span className={`font-mono font-bold ${isComplete ? "text-emerald-400" : "text-orange-400"}`}>
          {currentProgress}%
        </span>
      </div>
      <div className="w-full bg-[#070c14] border border-blue-500/20 rounded-full h-2 p-0.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete
              ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
              : "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"
          }`}
          style={{ width: `${Math.min(Math.max(currentProgress, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
