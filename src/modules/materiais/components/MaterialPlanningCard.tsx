import React from "react";
import { MaterialPlanningMetrics, MaterialStockStatus } from "../types/material.types";

interface MaterialPlanningCardProps {
  metrics: MaterialPlanningMetrics;
  onSelect: () => void;
  isSelected?: boolean;
}

export function MaterialPlanningCard({ metrics, onSelect, isSelected = false }: MaterialPlanningCardProps) {
  const { material, plannedOriginal, consumedReal, remainingPlanned, projectedStock, availablePercentageAfterPlanning, projectedStatus } = metrics;

  const getStatusBadge = (status: MaterialStockStatus) => {
    switch (status) {
      case "adequado":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Adequado
          </span>
        );
      case "atencao":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Atenção
          </span>
        );
      case "critico":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {projectedStock <= 0 ? "Insuficiente" : "Crítico"}
          </span>
        );
    }
  };

  const getBarColor = () => {
    if (projectedStatus === "critico") return "bg-rose-500";
    if (projectedStatus === "atencao") return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-lg border p-4 space-y-4 shadow-xs transition-all cursor-pointer hover:border-blue-300 ${
        isSelected
          ? "border-blue-500 bg-blue-50/20 ring-1 ring-blue-400"
          : "border-slate-200"
      }`}
    >
      {/* 1. CABEÇALHO DO CARD */}
      <div className="flex justify-between items-start gap-2">
        <div>
          <span className="font-mono font-bold text-xs text-blue-700 tracking-wider">
            {material.code}
          </span>
          <h3 className="font-semibold text-sm text-slate-900 leading-snug line-clamp-1 mt-0.5">
            {material.name}
          </h3>
          <p className="text-[11px] text-slate-500 line-clamp-1">
            {material.type} {material.manufacturer ? `• ${material.manufacturer}` : ""}
          </p>
        </div>
        <div>{getStatusBadge(projectedStatus)}</div>
      </div>

      {/* 2. DESTAQUE DO ESTOQUE ATUAL FÍSICO */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3 flex justify-between items-center">
        <div>
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
            Estoque Físico Atual
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold font-mono text-slate-900">
              {material.currentStock}
            </span>
            <span className="text-xs text-blue-700 font-mono font-semibold">{material.unit}</span>
          </div>
        </div>

        <div className="text-right border-l border-slate-200 pl-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
            Estoque Mínimo
          </span>
          <span className="text-xs font-mono text-slate-700 font-semibold block mt-0.5">
            {material.minimumStock} {material.unit}
          </span>
        </div>
      </div>

      {/* 3. GRADE OPERACIONAL: PLANEJADO vs REAL vs RESTANTE vs PROJETADO */}
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between items-center py-1 border-b border-slate-100">
          <span className="text-slate-500 font-mono text-[11px]">Planejado Original:</span>
          <span className="font-mono text-slate-800">
            {plannedOriginal} {material.unit}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-slate-100">
          <span className="text-slate-500 font-mono text-[11px]">Consumido Real:</span>
          <span className="font-mono font-semibold text-orange-600">
            {consumedReal} {material.unit}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-slate-100">
          <span className="text-slate-500 font-mono text-[11px]">Demanda Restante:</span>
          <span className="font-mono text-blue-700">
            {remainingPlanned} {material.unit}
          </span>
        </div>

        <div className="flex justify-between items-center py-1.5 bg-slate-50 px-2 rounded font-semibold">
          <span className="text-slate-700 font-mono text-[11px]">Estoque Projetado:</span>
          <span
            className={`font-mono text-xs ${
              projectedStatus === "critico"
                ? "text-rose-700"
                : projectedStatus === "atencao"
                ? "text-amber-700"
                : "text-emerald-700"
            }`}
          >
            {projectedStock} {material.unit}
          </span>
        </div>
      </div>

      {/* 4. BARRA DE COBERTURA PROJETADA */}
      <div className="space-y-1 pt-1">
        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
          <span>Cobertura da Demanda</span>
          <span className="font-bold text-slate-800">{availablePercentageAfterPlanning}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
            style={{ width: `${Math.min(Math.max(availablePercentageAfterPlanning, 0), 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
