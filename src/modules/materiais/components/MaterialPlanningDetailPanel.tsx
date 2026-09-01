import React from "react";
import { MaterialPlanningMetrics, MaterialStockStatus } from "../types/material.types";
import { PermissionGate } from "@/components/auth/PermissionGate";

interface MaterialPlanningDetailPanelProps {
  metrics: MaterialPlanningMetrics;
  onClose: () => void;
  onEditMaterial: () => void;
  onDeleteMaterial: () => void;
  onAddStock: () => void;
  onGeneratePdf: () => void;
  isDeleting?: boolean;
  isGeneratingPdf?: boolean;
}

export function MaterialPlanningDetailPanel({
  metrics,
  onClose,
  onEditMaterial,
  onDeleteMaterial,
  onAddStock,
  onGeneratePdf,
  isDeleting = false,
  isGeneratingPdf = false,
}: MaterialPlanningDetailPanelProps) {
  const { material, plannedOriginal, consumedReal, remainingPlanned, projectedStock, deviation, projectedStatus, linkedActivities } = metrics;

  const getStatusBadge = (status: MaterialStockStatus) => {
    switch (status) {
      case "adequado":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-[#090d16] text-emerald-400 border border-emerald-500/30 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Adequado
          </span>
        );
      case "atencao":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-[#090d16] text-amber-400 border border-amber-500/30 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Atenção
          </span>
        );
      case "critico":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-[#090d16] text-rose-400 border border-rose-500/30 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            {projectedStock <= 0 ? "Insuficiente" : "Crítico"}
          </span>
        );
    }
  };

  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-lg p-5 space-y-4 shadow-xl text-slate-200">
      {/* 1. CABEÇALHO */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">
            {material.code}
          </span>
          <h3 className="text-base font-bold text-slate-100 mt-0.5 leading-snug">
            {material.name}
          </h3>
          <p className="text-xs text-slate-400">
            {material.type} {material.manufacturer ? `• ${material.manufacturer}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-xs px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors"
        >
          Fechar
        </button>
      </div>

      {/* 2. ÁREA DE AÇÕES CADASTRAIS */}
      <div className="flex items-center gap-2 flex-wrap border-b border-white/5 pb-3 pt-1">
        <PermissionGate permission="materiais.editar">
          <button
            type="button"
            onClick={onEditMaterial}
            className="text-xs font-semibold px-2.5 py-1 bg-[#090d16] hover:bg-white/5 text-slate-200 rounded border border-white/10 hover:border-white/20 transition-colors"
          >
            Editar Catálogo
          </button>
        </PermissionGate>

        <PermissionGate permission="materiais.editar">
          <button
            type="button"
            onClick={onDeleteMaterial}
            disabled={isDeleting}
            className="text-xs font-semibold px-2.5 py-1 bg-[#090d16] hover:bg-rose-500/10 text-rose-300 rounded border border-rose-500/30 hover:border-rose-500/50 transition-colors"
          >
            {isDeleting ? "Inativando..." : "Inativar"}
          </button>
        </PermissionGate>

        <button
          type="button"
          onClick={onGeneratePdf}
          disabled={isGeneratingPdf}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-[#090d16] hover:bg-white/5 text-emerald-400 rounded border border-emerald-500/30 hover:border-emerald-500/50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>{isGeneratingPdf ? "Gerando..." : "Gerar PDF"}</span>
        </button>
      </div>

      {/* 3. SITUAÇÃO E ESTOQUE FÍSICO */}
      <div className="flex items-center gap-2 flex-wrap">
        {getStatusBadge(projectedStatus)}
        <span className="text-xs text-slate-400 font-mono">Unidade: {material.unit}</span>
      </div>

      {/* 4. BLOCO DE SALDO E PLANEJAMENTO NO PERÍODO */}
      <div className="bg-[#090d16] border border-white/5 rounded-md p-3.5 space-y-2 text-xs">
        <div className="flex justify-between items-center py-0.5 border-b border-white/5">
          <span className="text-slate-400 font-mono">Estoque Físico Atual:</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">
            {material.currentStock} {material.unit}
          </span>
        </div>
        <div className="flex justify-between items-center py-0.5 border-b border-white/5">
          <span className="text-slate-400 font-mono">Estoque Mínimo:</span>
          <span className="font-mono text-slate-300">
            {material.minimumStock} {material.unit}
          </span>
        </div>
        <div className="flex justify-between items-center py-0.5 border-b border-white/5">
          <span className="text-slate-400 font-mono">Planejado no Período:</span>
          <span className="font-mono text-slate-200">
            {plannedOriginal} {material.unit}
          </span>
        </div>
        <div className="flex justify-between items-center py-0.5 border-b border-white/5">
          <span className="text-slate-400 font-mono">Consumido Real:</span>
          <span className="font-mono font-semibold text-emerald-400">
            {consumedReal} {material.unit}
          </span>
        </div>
        <div className="flex justify-between items-center py-0.5 border-b border-white/5">
          <span className="text-slate-400 font-mono">Ainda Planejado (Restante):</span>
          <span className="font-mono font-semibold text-sky-400">
            {remainingPlanned} {material.unit}
          </span>
        </div>
        <div className="flex justify-between items-center py-1 bg-white/5 px-2 rounded">
          <span className="text-slate-200 font-mono font-bold">Saldo Projetado:</span>
          <span
            className={`font-mono font-bold text-sm ${
              projectedStock <= 0
                ? "text-rose-400"
                : projectedStock < material.minimumStock
                ? "text-amber-400"
                : "text-emerald-400"
            }`}
          >
            {projectedStock} {material.unit}
          </span>
        </div>
        {deviation > 0 && (
          <div className="flex justify-between items-center py-0.5 text-amber-400 text-[11px] font-mono">
            <span>Desvio Acima do Planejado:</span>
            <span>+{deviation} {material.unit}</span>
          </div>
        )}
      </div>

      {/* 5. ATIVIDADES VINCULADAS NO PERÍODO */}
      <div className="space-y-2 pt-1">
        <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider flex items-center justify-between">
          <span>Atividades Demandantes ({linkedActivities.length})</span>
        </h4>

        {linkedActivities.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 bg-[#090d16] rounded border border-white/5">
            Nenhuma atividade programada para este material no período selecionado.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {linkedActivities.map((act) => {
              const isDone = act.status === "concluida";
              return (
                <div
                  key={act.activityId}
                  className="bg-[#090d16] border border-white/5 rounded p-3 text-xs space-y-1.5"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-emerald-400">{act.orderNumber}</span>
                    <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded border ${
                      isDone
                        ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                        : "text-sky-400 border-sky-500/30 bg-sky-500/10"
                    }`}>
                      {act.status} ({act.progressPercentage}%)
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-200 font-medium leading-tight">{act.activityName}</p>

                  <div className="flex justify-between items-center pt-1 border-t border-white/5 text-[11px] font-mono text-slate-400">
                    <span>
                      Consumido: <strong className="text-emerald-400">{act.consumedQuantity} {act.unit}</strong>
                    </span>
                    <span>
                      Planejado: <strong className="text-slate-300">{act.plannedQuantity} {act.unit}</strong>
                    </span>
                    <span>
                      Restante: <strong className="text-sky-400">{act.remainingPlannedQuantity} {act.unit}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. BOTÃO DE ENTRADA DE ESTOQUE */}
      <div className="pt-2">
        <PermissionGate permission="estoque.movimentar">
          <button
            type="button"
            onClick={onAddStock}
            className="w-full text-xs font-bold py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-[0_0_12px_-2px_rgba(16,185,129,0.4)] transition-colors"
          >
            + Registrar Entrada de Estoque
          </button>
        </PermissionGate>
      </div>
    </div>
  );
}
