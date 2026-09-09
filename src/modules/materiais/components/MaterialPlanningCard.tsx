import React from "react";
import { MaterialPlanningMetrics } from "../types/material.types";

interface MaterialPlanningCardProps {
  metrics: MaterialPlanningMetrics;
  isSelected?: boolean;
  onSelect: (metrics: MaterialPlanningMetrics) => void;
}

export function MaterialPlanningCard({
  metrics,
  isSelected = false,
  onSelect,
}: MaterialPlanningCardProps) {
  const { material, plannedOriginal } = metrics;

  return (
    <div
      onClick={() => onSelect(metrics)}
      className={`bg-[#0c1524] border rounded-lg p-4 cursor-pointer transition-all shadow-sm space-y-3.5 ${
        isSelected
          ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30 shadow-[0_0_15px_-2px_rgba(16,185,129,0.25)]"
          : "border-blue-500/15 hover:border-emerald-500/35 hover:bg-[#131f33]/40"
      }`}
    >
      {/* Topo: Nome, Código e Tipo */}
      <div className="space-y-1">
        <h3 className="font-bold text-white text-sm leading-snug tracking-tight">
          {material.name}
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-slate-400">
            Código: <span className="text-slate-200 font-bold">{material.code}</span>
          </span>
          {material.type && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 text-[11px] truncate">
                {material.type} {material.manufacturer ? `(${material.manufacturer})` : ""}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Bloco Central: Apenas ESTOQUE e PLANEJADO */}
      <div className="grid grid-cols-2 divide-x divide-white/10 bg-[#070c14] border border-white/10 rounded-lg overflow-hidden">
        {/* Estoque Atual */}
        <div className="p-3">
          <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider block">
            Estoque
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-xl font-bold font-mono ${material.currentStock <= 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {material.currentStock}
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">
              {material.unit}
            </span>
          </div>
        </div>

        {/* Planejado */}
        <div className="p-3 pl-4">
          <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider block">
            Planejado
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-100">
              {plannedOriginal}
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">
              {material.unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
