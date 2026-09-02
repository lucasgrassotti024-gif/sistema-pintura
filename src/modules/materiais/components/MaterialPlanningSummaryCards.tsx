import React from "react";
import { MaterialPlanningSummary } from "../types/material.types";

interface MaterialPlanningSummaryCardsProps {
  summary: MaterialPlanningSummary;
}

export function MaterialPlanningSummaryCards({ summary }: MaterialPlanningSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* 1. Total de Materiais Cadastrados */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-1">
        <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
          Materiais em Catálogo
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-slate-900">
            {summary.totalMaterialsCount}
          </span>
          <span className="text-[10px] text-blue-700 font-mono">itens</span>
        </div>
      </div>

      {/* 2. Materiais em Risco */}
      <div className="bg-white border border-amber-200 rounded-lg p-3.5 shadow-xs space-y-1">
        <span className="text-[11px] font-mono text-amber-700 uppercase tracking-wider block flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Em Ponto de Atenção
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-amber-700">
            {summary.atRiskCount}
          </span>
          <span className="text-[10px] text-amber-600 font-mono">materiais</span>
        </div>
      </div>

      {/* 3. Materiais Insuficientes */}
      <div className="bg-white border border-rose-200 rounded-lg p-3.5 shadow-xs space-y-1">
        <span className="text-[11px] font-mono text-rose-700 uppercase tracking-wider block flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Em Risco / Insuficientes
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-rose-700">
            {summary.insufficientCount}
          </span>
          <span className="text-[10px] text-rose-600 font-mono">críticos</span>
        </div>
      </div>

      {/* 4. Volume Planejado no Período */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-1">
        <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
          Volume Planejado
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-blue-700">
            {summary.totalPlannedVolume}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">total</span>
        </div>
      </div>

      {/* 5. Volume Consumido no Período */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-1 col-span-2 sm:col-span-1">
        <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
          Volume Consumido
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-orange-600">
            {summary.totalConsumedVolume}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">realizado</span>
        </div>
      </div>
    </div>
  );
}
