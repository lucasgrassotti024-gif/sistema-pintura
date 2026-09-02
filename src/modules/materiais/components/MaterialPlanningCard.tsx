import React from "react";
import { MaterialPlanningMetrics, MaterialStockStatus } from "../types/material.types";

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
  const { material, plannedOriginal, consumedReal, remainingPlanned, projectedStock, deviation, projectedStatus } = metrics;

  const getStatusBadge = (status: MaterialStockStatus) => {
    switch (status) {
      case "adequado":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Adequado
          </span>
        );
      case "atencao":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Atenção
          </span>
        );
      case "critico":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            {projectedStock <= 0 ? "Insuficiente" : "Crítico"}
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => onSelect(metrics)}
      className={`bg-[#0c1524] border rounded-lg p-4 cursor-pointer transition-all shadow-sm space-y-3 ${
        isSelected
          ? "border-orange-500/60 bg-orange-500/5 ring-1 ring-orange-500/30 shadow-[0_0_15px_-2px_rgba(249,115,22,0.25)]"
          : "border-blue-500/15 hover:border-blue-500/35 hover:bg-[#131f33]/40"
      }`}
    >
      {/* Topo: Código, Nome e Badge */}
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-0.5">
          <span className="font-mono font-bold text-xs text-blue-400 tracking-wider">
            {material.code}
          </span>
          <h3 className="font-bold text-white text-xs leading-snug">
            {material.name}
          </h3>
          <span className="text-[11px] text-slate-400 block">
            {material.type} {material.manufacturer ? `• ${material.manufacturer}` : ""}
          </span>
        </div>
        {getStatusBadge(projectedStatus)}
      </div>

      {/* Grid de Saldos e Consumos */}
      <div className="grid grid-cols-2 gap-2 text-xs bg-[#070c14] border border-blue-500/15 rounded p-2.5">
        <div>
          <span className="text-slate-400 text-[10px] font-mono block">Estoque Físico</span>
          <span className="font-bold font-mono text-white text-sm">
            {material.currentStock} {material.unit}
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-[10px] font-mono block">Estoque Projetado</span>
          <span
            className={`font-bold font-mono text-sm ${
              projectedStock <= 0 ? "text-rose-400" : projectedStock < material.minimumStock ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {projectedStock} {material.unit}
          </span>
        </div>
        <div className="pt-1.5 border-t border-blue-500/10">
          <span className="text-slate-400 text-[10px] font-mono block">Demanda Original</span>
          <span className="font-mono text-slate-200 text-xs">
            {plannedOriginal} {material.unit}
          </span>
        </div>
        <div className="pt-1.5 border-t border-blue-500/10">
          <span className="text-slate-400 text-[10px] font-mono block">Consumo Real</span>
          <span className="font-mono text-orange-400 font-bold text-xs">
            {consumedReal} {material.unit}
          </span>
        </div>
      </div>

      {/* Rodapé do Card: Desvio e Demanda Restante */}
      <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 pt-1">
        <span>Restante a Consumir: <strong className="text-blue-300">{remainingPlanned} {material.unit}</strong></span>
        {deviation !== 0 && (
          <span className={deviation > 0 ? "text-amber-400" : "text-emerald-400"}>
            Desvio: {deviation > 0 ? `+${deviation}` : deviation} {material.unit}
          </span>
        )}
      </div>
    </div>
  );
}
