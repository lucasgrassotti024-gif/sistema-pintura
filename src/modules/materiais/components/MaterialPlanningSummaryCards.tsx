import React from "react";
import { MaterialPlanningSummary } from "../types/material.types";

interface MaterialPlanningSummaryCardsProps {
  summary: MaterialPlanningSummary;
}

export function MaterialPlanningSummaryCards({ summary }: MaterialPlanningSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* Total de Materiais */}
      <div className="bg-[#0c1524] border border-blue-500/15 rounded-lg p-3.5 shadow-sm space-y-1">
        <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider block">
          Catálogo Total
        </span>
        <div className="flex items-baseline gap-1.5 pt-1">
          <span className="text-2xl font-bold font-mono text-white">
            {summary.totalMaterialsCount}
          </span>
          <span className="text-[10px] text-slate-400">itens</span>
        </div>
        <span className="text-[10px] text-slate-500 block pt-1 border-t border-blue-500/10">
          Insumos ativos
        </span>
      </div>

      {/* Em Risco / Atenção */}
      <div className="bg-[#0c1524] border border-amber-500/30 rounded-lg p-3.5 shadow-sm space-y-1">
        <span className="text-[11px] font-mono font-semibold text-amber-400 uppercase tracking-wider block">
          Em Risco (Atenção)
        </span>
        <div className="flex items-baseline gap-1.5 pt-1">
          <span className="text-2xl font-bold font-mono text-amber-400">
            {summary.atRiskCount}
          </span>
          <span className="text-[10px] text-slate-400">itens</span>
        </div>
        <span className="text-[10px] text-amber-400/70 block pt-1 border-t border-amber-500/20">
          Próximo ao mínimo
        </span>
      </div>

      {/* Insuficientes / Críticos */}
      <div className="bg-[#0c1524] border border-rose-500/30 rounded-lg p-3.5 shadow-sm space-y-1">
        <span className="text-[11px] font-mono font-semibold text-rose-400 uppercase tracking-wider block">
          Insuficientes
        </span>
        <div className="flex items-baseline gap-1.5 pt-1">
          <span className="text-2xl font-bold font-mono text-rose-400">
            {summary.insufficientCount}
          </span>
          <span className="text-[10px] text-slate-400">itens</span>
        </div>
        <span className="text-[10px] text-rose-400/70 block pt-1 border-t border-rose-500/20">
          Projeção negativa
        </span>
      </div>

      {/* Demanda Total Planejada */}
      <div className="bg-[#0c1524] border border-blue-500/15 rounded-lg p-3.5 shadow-sm space-y-1">
        <span className="text-[11px] font-mono font-semibold text-blue-400 uppercase tracking-wider block">
          Demanda Planejada
        </span>
        <div className="flex items-baseline gap-1.5 pt-1">
          <span className="text-2xl font-bold font-mono text-blue-300">
            {summary.totalPlannedVolume}
          </span>
          <span className="text-[10px] text-slate-400">L / un</span>
        </div>
        <span className="text-[10px] text-slate-500 block pt-1 border-t border-blue-500/10">
          Planejado nas OSs
        </span>
      </div>

      {/* Consumo Real Apontado */}
      <div className="bg-[#0c1524] border border-blue-500/15 rounded-lg p-3.5 shadow-sm space-y-1">
        <span className="text-[11px] font-mono font-semibold text-orange-400 uppercase tracking-wider block">
          Consumo Real
        </span>
        <div className="flex items-baseline gap-1.5 pt-1">
          <span className="text-2xl font-bold font-mono text-orange-400">
            {summary.totalConsumedVolume}
          </span>
          <span className="text-[10px] text-slate-400">L / un</span>
        </div>
        <span className="text-[10px] text-slate-500 block pt-1 border-t border-blue-500/10">
          Apontamentos reais
        </span>
      </div>
    </div>
  );
}
