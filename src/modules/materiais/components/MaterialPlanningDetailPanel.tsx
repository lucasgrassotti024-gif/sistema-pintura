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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Adequado
          </span>
        );
      case "atencao":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Atenção
          </span>
        );
      case "critico":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {projectedStock <= 0 ? "Insuficiente" : "Crítico"}
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm text-slate-800">
      {/* 1. CABEÇALHO */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold text-blue-700 tracking-wider">
            {material.code}
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-0.5 leading-snug">
            {material.name}
          </h3>
          <p className="text-xs text-slate-500">
            {material.type} {material.manufacturer ? `• ${material.manufacturer}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-800 text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
        >
          Fechar
        </button>
      </div>

      {/* 2. ÁREA DE AÇÕES CADASTRAIS */}
      <div className="flex items-center gap-2 flex-wrap border-b border-slate-100 pb-3 pt-1">
        <PermissionGate permission="materiais.editar">
          <button
            type="button"
            onClick={onEditMaterial}
            className="text-xs font-semibold px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-300 transition-colors"
          >
            Editar Catálogo
          </button>
        </PermissionGate>

        <PermissionGate permission="materiais.editar">
          <button
            type="button"
            onClick={onDeleteMaterial}
            disabled={isDeleting}
            className="text-xs font-semibold px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 transition-colors"
          >
            {isDeleting ? "Inativando..." : "Inativar"}
          </button>
        </PermissionGate>

        <button
          type="button"
          onClick={onGeneratePdf}
          disabled={isGeneratingPdf}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>{isGeneratingPdf ? "Gerando..." : "Gerar PDF"}</span>
        </button>
      </div>

      {/* 3. SITUAÇÃO ATUAL */}
      <div>{getStatusBadge(projectedStatus)}</div>

      {/* 4. QUADRO TÉCNICO DE SALDOS */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2 text-xs">
        <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
          <span className="text-slate-500 font-mono">Estoque Físico Atual:</span>
          <span className="font-bold text-slate-900 font-mono">
            {material.currentStock} {material.unit}
          </span>
        </div>
        <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
          <span className="text-slate-500 font-mono">Estoque Mínimo Exigido:</span>
          <span className="font-semibold text-slate-700 font-mono">
            {material.minimumStock} {material.unit}
          </span>
        </div>
        <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
          <span className="text-slate-500 font-mono">Demanda Original:</span>
          <span className="font-mono text-slate-800">
            {plannedOriginal} {material.unit}
          </span>
        </div>
        <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
          <span className="text-slate-500 font-mono">Consumo Real Apontado:</span>
          <span className="font-mono font-bold text-orange-600">
            {consumedReal} {material.unit}
          </span>
        </div>
        <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
          <span className="text-slate-500 font-mono">Demanda Restante a Consumir:</span>
          <span className="font-mono text-blue-700">
            {remainingPlanned} {material.unit}
          </span>
        </div>
        <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
          <span className="text-slate-500 font-mono">Desvio Real vs Planejado:</span>
          <span className={`font-mono font-bold ${deviation > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {deviation > 0 ? `+${deviation}` : deviation} {material.unit}
          </span>
        </div>
        <div className="flex justify-between items-center py-1 bg-slate-100 px-2 rounded font-bold">
          <span className="text-slate-800 font-mono">Estoque Final Projetado:</span>
          <span className={`font-mono ${projectedStock <= 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {projectedStock} {material.unit}
          </span>
        </div>
      </div>

      {/* 5. AÇÃO DE MOVIMENTAÇÃO */}
      <PermissionGate permission="estoque.movimentar">
        <div>
          <button
            type="button"
            onClick={onAddStock}
            className="w-full text-xs font-bold py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md shadow-xs transition-all active:scale-[0.99]"
          >
            + Registrar Entrada de Estoque
          </button>
        </div>
      </PermissionGate>

      {/* 6. ATIVIDADES VINCULADAS */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
          Ordens de Serviço Vinculadas ({linkedActivities.length})
        </h4>

        {linkedActivities.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">
            Nenhuma atividade no período consome este material.
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {linkedActivities.map((act) => (
              <div
                key={act.activityId}
                className="bg-slate-50 border border-slate-200 rounded p-2 text-xs space-y-1"
              >
                <div className="flex justify-between items-start">
                  <span className="font-mono font-bold text-blue-700">{act.orderNumber}</span>
                  <span className="text-[10px] font-mono text-slate-500">{act.status}</span>
                </div>
                <p className="font-semibold text-slate-900 truncate">{act.activityName}</p>
                <div className="flex justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-200 font-mono">
                  <span>Plan: {act.plannedQuantity} {material.unit}</span>
                  <span className="text-orange-600 font-bold">Real: {act.consumedQuantity} {material.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
