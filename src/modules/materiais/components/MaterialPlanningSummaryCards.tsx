import React from "react";
import { MaterialPlanningSummary } from "../types/material.types";

interface MaterialPlanningSummaryCardsProps {
  summary: MaterialPlanningSummary;
}

export function MaterialPlanningSummaryCards({ summary }: MaterialPlanningSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* 1. Total de Materiais Cadastrados */}
      <div className="bg-[#0f172a] border border-white/10 rounded-lg p-3.5 shadow-sm space-y-1">
        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
          Materiais em Catálogo
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-slate-100">
            {summary.totalMaterialsCount}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">itens</span>
        </div>
      </div>

      {/* 2. Materiais em Risco */}
      <div className="bg-[#0f172a] border border-amber-500/20 bg-amber-500/5 rounded-lg p-3.5 shadow-sm space-y-1">
        <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider block flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Em Ponto de Atenção
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-amber-300">
            {summary.atRiskCount}
          </span>
          <span className="text-[10px] text-amber-400/70 font-mono">materiais</span>
        </div>
      </div>

      {/* 3. Materiais Insuficientes */}
      <div className="bg-[#0f172a] border border-rose-500/20 bg-rose-500/5 rounded-lg p-3.5 shadow-sm space-y-1">
        <span className="text-[11px] font-mono text-rose-400 uppercase tracking-wider block flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          Em Risco / Insuficientes
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-rose-300">
            {summary.insufficientCount}
          </span>
          <span className="text-[10px] text-rose-400/70 font-mono">críticos</span>
        </div>
      </div>

      {/* 4. Volume Planejado no Período */}
      <div className="bg-[#0f172a] border border-white/10 rounded-lg p-3.5 shadow-sm space-y-1">
        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
          Volume Planejado
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-sky-400">
            {summary.totalPlannedVolume}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">total</span>
        </div>
      </div>

      {/* 5. Volume Consumido no Período */}
      <div className="bg-[#0f172a] border border-white/10 rounded-lg p-3.5 shadow-sm space-y-1 col-span-2 sm:col-span-1">
        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
          Volume Consumido
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-emerald-400">
            {summary.totalConsumedVolume}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">realizado</span>
        </div>
      </div>
    </div>
  );
}
