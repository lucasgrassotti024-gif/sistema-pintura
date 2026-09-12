import React from "react";
import { MaterialPlanningMetrics } from "../types/material.types";
import { PermissionGate } from "@/components/auth/PermissionGate";

interface MaterialPlanningCardProps {
  metrics: MaterialPlanningMetrics;
  isSelected?: boolean;
  onSelect: (metrics: MaterialPlanningMetrics) => void;
  onAdjustStock?: (materialId: string) => void;
}

export function MaterialPlanningCard({
  metrics,
  isSelected = false,
  onSelect,
  onAdjustStock,
}: MaterialPlanningCardProps) {
  const { material, plannedOriginal, projectedStatus, linkedActivities } = metrics;
  const currentStock = Number(material.currentStock) || 0;
  const minimumStock = Number(material.minimumStock) || 0;
  const activitiesCount = linkedActivities?.length || 0;

  // Formatação amigável de números (ex: 44.6 -> "44,6" ou "44")
  const formatQuantity = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Status visual: OK (Adequado), Atenção (Próximo ao mínimo), Repor (Crítico / Insuficiente)
  const renderStatusBadge = () => {
    switch (projectedStatus) {
      case "adequado":
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded text-xs font-mono font-bold tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            OK
          </span>
        );
      case "atencao":
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded text-xs font-mono font-bold tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Atenção
          </span>
        );
      case "critico":
      default:
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded text-xs font-mono font-bold tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_12px_-2px_rgba(244,63,94,0.3)]">
            Repor
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => onSelect(metrics)}
      className={`group relative bg-[#0c1524] border rounded-xl p-4 transition-all duration-200 cursor-pointer shadow-md select-none ${
        isSelected
          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/40 shadow-[0_0_20px_-3px_rgba(59,130,246,0.3)]"
          : "border-blue-500/15 hover:border-blue-500/40 hover:bg-[#101b2e]"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* LADO ESQUERDO: Foto/Ícone + Identificação + Métricas */}
        <div className="flex items-start md:items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
          {/* 1. Imagem / Thumbnail do Material */}
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg overflow-hidden bg-[#070c14] border border-blue-500/20 flex items-center justify-center shadow-inner">
            <div className="flex flex-col items-center justify-center text-slate-500 group-hover:text-blue-400 transition-colors">
              <svg
                className="w-7 h-7 sm:w-8 sm:h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                />
              </svg>
              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 mt-1">
                {material.unit}
              </span>
            </div>
          </div>

          {/* 2. Informações de Identificação & Métricas Principais */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Topo do Material: Nome, Badge e Subtítulo */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-white text-sm sm:text-base tracking-tight truncate max-w-md group-hover:text-blue-300 transition-colors">
                  {material.name}
                </h3>
                {material.type && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 shrink-0">
                    {material.type}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 mt-0.5">
                <span className="font-mono text-slate-300">
                  Cód. <span className="font-bold">{material.code}</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">
                  {material.unit}
                  {material.color ? ` · ${material.color}` : ""}
                  {material.manufacturer ? ` · ${material.manufacturer}` : ""}
                </span>
              </div>
            </div>

            {/* Grid Horizontal de Métricas: ESTOQUE, IDEAL, PLANEJADO */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-1 max-w-xl">
              {/* EM ESTOQUE */}
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Em Estoque
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span
                    className={`text-lg sm:text-xl font-mono font-bold ${
                      currentStock <= 0
                        ? "text-rose-400"
                        : currentStock <= minimumStock
                        ? "text-orange-400"
                        : "text-orange-300"
                    }`}
                  >
                    {formatQuantity(currentStock)}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {material.unit}
                  </span>
                </div>
              </div>

              {/* IDEAL (Mínimo) */}
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Ideal
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg sm:text-xl font-mono font-bold text-slate-200">
                    {formatQuantity(minimumStock)}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {material.unit}
                  </span>
                </div>
              </div>

              {/* PLANEJADO (Obrigatório + contagem discreta de atividades) */}
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Planejado
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <svg
                    className="w-3.5 h-3.5 text-blue-400 shrink-0 self-center"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                  <span className="text-lg sm:text-xl font-mono font-bold text-white">
                    {formatQuantity(plannedOriginal)}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {material.unit}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                  em {activitiesCount} {activitiesCount === 1 ? "atividade" : "atividades"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* LADO DIREITO (Desktop) / BASE (Mobile): Status e Botão Ajustar */}
        <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-3 md:pt-0 border-t border-blue-500/10 md:border-t-0 shrink-0">
          {/* Status */}
          <div>{renderStatusBadge()}</div>

          {/* Botão Ajustar */}
          {onAdjustStock && (
            <PermissionGate permission="estoque.movimentar">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjustStock(material.id);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#070c14] hover:bg-orange-500/15 text-slate-300 hover:text-orange-400 border border-blue-500/20 hover:border-orange-500/40 text-xs font-semibold transition-all duration-150 active:scale-95"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                  />
                </svg>
                <span>Ajustar</span>
              </button>
            </PermissionGate>
          )}
        </div>
      </div>
    </div>
  );
}
