import React from "react";
import { MaterialPlanningSummary } from "../types/material.types";

interface MaterialPlanningSummaryCardsProps {
  summary: MaterialPlanningSummary;
}

export function MaterialPlanningSummaryCards({ summary }: MaterialPlanningSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {/* Total de Materiais */}
      <div className="bg-[#0c1524]/70 border border-blue-500/15 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
        <div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block leading-tight">
            Catálogo
          </span>
          <span className="text-[9px] text-slate-500 block leading-tight">
            ativos
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold font-mono text-white">
            {summary.totalMaterialsCount}
          </span>
          <span className="text-[9px] text-slate-400">un</span>
        </div>
      </div>

      {/* Em Risco / Atenção */}
      <div className="bg-[#0c1524]/70 border border-amber-500/20 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
        <div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 block leading-tight">
            Atenção
          </span>
          <span className="text-[9px] text-amber-500/60 block leading-tight">
            próx. mínimo
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold font-mono text-amber-400">
            {summary.atRiskCount}
          </span>
          <span className="text-[9px] text-slate-400">un</span>
        </div>
      </div>

      {/* Insuficientes / Críticos */}
      <div className="bg-[#0c1524]/70 border border-rose-500/20 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
        <div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-rose-400/90 block leading-tight">
            Repor
          </span>
          <span className="text-[9px] text-rose-500/60 block leading-tight">
            crítico
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold font-mono text-rose-400">
            {summary.insufficientCount}
          </span>
          <span className="text-[9px] text-slate-400">un</span>
        </div>
      </div>

      {/* Demanda Total Planejada */}
      <div className="bg-[#0c1524]/70 border border-blue-500/15 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
        <div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-blue-400/90 block leading-tight">
            Planejado
          </span>
          <span className="text-[9px] text-slate-500 block leading-tight">
            em ordens
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold font-mono text-blue-300">
            {summary.totalPlannedVolume}
          </span>
          <span className="text-[9px] text-slate-400">L</span>
        </div>
      </div>

      {/* Consumo Real Apontado */}
      <div className="bg-[#0c1524]/70 border border-orange-500/15 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
        <div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-orange-400/90 block leading-tight">
            Consumo
          </span>
          <span className="text-[9px] text-slate-500 block leading-tight">
            apontado
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold font-mono text-orange-400">
            {summary.totalConsumedVolume}
          </span>
          <span className="text-[9px] text-slate-400">L</span>
        </div>
      </div>
    </div>
  );
}
