"use client";

import React, { useState } from "react";
import { useMaterials } from "@/modules/materiais/hooks/useMaterials";
import { Material, NewMaterialInput, PlanningPeriodFilter, StockEntryInput } from "@/modules/materiais/types/material.types";
import { MaterialForm } from "@/modules/materiais/components/MaterialForm";
import { StockEntryModal } from "@/modules/materiais/components/StockEntryModal";
import { MaterialPlanningSummaryCards } from "@/modules/materiais/components/MaterialPlanningSummaryCards";
import { MaterialPlanningCard } from "@/modules/materiais/components/MaterialPlanningCard";
import { MaterialPlanningDetailPanel } from "@/modules/materiais/components/MaterialPlanningDetailPanel";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { generateMaterialPdf } from "@/modules/materiais/services/material-pdf.service";

export default function MateriaisEstoquePage() {
  const {
    rawMaterials,
    planningMetricsList,
    selectedMetrics,
    selectedMaterialId,
    setSelectedMaterialId,
    period,
    setPeriod,
    summary,
    isLoading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    addNewMaterial,
    editMaterial,
    removeMaterial,
    addStockEntry,
  } = useMaterials();

  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleSaveNewMaterial = async (input: NewMaterialInput) => {
    await addNewMaterial(input);
    setIsCreatingMaterial(false);
  };

  const handleSaveEditMaterial = async (input: NewMaterialInput & { active?: boolean }) => {
    if (editingMaterial) {
      await editMaterial(editingMaterial.id, input);
      setEditingMaterial(null);
    }
  };

  const handleConfirmStockEntry = async (input: StockEntryInput) => {
    await addStockEntry(input);
    setIsAddingStock(false);
  };

  const handleConfirmDeleteMaterial = async () => {
    if (!selectedMetrics?.material) return;
    const mat = selectedMetrics.material;
    const confirmMsg = `Deseja realmente inativar o material "${mat.name}"?\n\nEle será desativado do catálogo para novos lançamentos, mas seu histórico de estoque e consumo será preservado integralmente.`;
    if (window.confirm(confirmMsg)) {
      setIsDeleting(true);
      try {
        await removeMaterial(mat.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao inativar material.");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleGeneratePdf = async () => {
    if (!selectedMetrics?.material) return;
    setIsGeneratingPdf(true);
    try {
      await generateMaterialPdf(selectedMetrics.material);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao gerar PDF do material.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO DA PÁGINA COM SELETOR DE PERÍODO E AÇÕES GERAIS */}
      <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <span>Planejamento & Estoque de Materiais</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitoramento de saldo físico, consumo real e projeção de disponibilidade por demanda operacional.
          </p>
        </div>

        {/* Grupo de Controles: Seletor de Período + Botões de Cadastro/Entrada */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Seletor de Período de Planejamento */}
          <div className="flex items-center bg-[#090d16] border border-white/10 rounded-lg p-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => setPeriod("semana")}
              className={`px-3 py-1 rounded transition-colors ${
                period === "semana"
                  ? "bg-emerald-600 text-white font-bold shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Esta Semana
            </button>
            <button
              type="button"
              onClick={() => setPeriod("mes")}
              className={`px-3 py-1 rounded transition-colors ${
                period === "mes"
                  ? "bg-emerald-600 text-white font-bold shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Este Mês
            </button>
            <button
              type="button"
              onClick={() => setPeriod("todas")}
              className={`px-3 py-1 rounded transition-colors ${
                period === "todas"
                  ? "bg-emerald-600 text-white font-bold shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Todas
            </button>
          </div>

          {/* Botão: Novo Material */}
          <PermissionGate permission="materiais.criar">
            <button
              type="button"
              onClick={() => {
                setSelectedMaterialId(null);
                setEditingMaterial(null);
                setIsCreatingMaterial(true);
              }}
              className="text-xs font-semibold px-3 py-1.5 bg-[#090d16] hover:bg-white/5 text-slate-200 rounded-md border border-white/10 hover:border-white/20 transition-colors"
            >
              + Novo Material
            </button>
          </PermissionGate>

          {/* Botão: Registrar Entrada de Estoque */}
          <PermissionGate permission="estoque.movimentar">
            <button
              type="button"
              onClick={() => setIsAddingStock(true)}
              className="text-xs font-bold px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md shadow-[0_0_12px_-2px_rgba(16,185,129,0.4)] transition-colors"
            >
              + Adicionar Material
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {isCreatingMaterial ? (
        <MaterialForm
          onSave={handleSaveNewMaterial}
          onCancel={() => setIsCreatingMaterial(false)}
        />
      ) : editingMaterial ? (
        <MaterialForm
          initialMaterial={editingMaterial}
          onSave={handleSaveEditMaterial}
          onCancel={() => setEditingMaterial(null)}
        />
      ) : (
        <>
          {/* 2. BLOCO SUPERIOR DE INDICADORES DE RESUMO (KPIS DO PERÍODO) */}
          <MaterialPlanningSummaryCards summary={summary} />

          {/* 3. BARRA DE BUSCA E FILTROS DE SITUAÇÃO */}
          <div className="bg-[#0f172a] border border-white/10 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-md">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Buscar Insumo no Catálogo
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por código, especificação técnica ou fabricante..."
                className="w-full text-xs bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Situação Projetada do Estoque
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
              >
                <option value="todos">Todas as Situações</option>
                <option value="adequado">Adequado (Acima do Mínimo)</option>
                <option value="atencao">Ponto de Atenção</option>
                <option value="critico">Crítico / Insuficiente</option>
              </select>
            </div>
          </div>

          {/* 4. GRADE PRINCIPAL RESPONSIVA DE MATERIAIS + PAINEL DE DETALHES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Listagem de Cards Operacionais */}
            <div className={selectedMetrics ? "lg:col-span-2 space-y-4" : "lg:col-span-3 space-y-4"}>
              {isLoading ? (
                <div className="p-12 text-center text-slate-400 font-mono text-xs bg-[#0f172a] rounded-lg border border-white/10">
                  Calculando projeções de consumo e estoque do período...
                </div>
              ) : planningMetricsList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs bg-[#0f172a] rounded-lg border border-white/10">
                  Nenhum material encontrado com os filtros aplicados.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {planningMetricsList.map((item) => (
                    <MaterialPlanningCard
                      key={item.material.id}
                      metrics={item}
                      isSelected={selectedMaterialId === item.material.id}
                      onSelect={() => setSelectedMaterialId(item.material.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Painel Lateral de Detalhes da Demanda e Ordens de Serviço */}
            {selectedMetrics && (
              <div className="lg:col-span-1 sticky top-6">
                <MaterialPlanningDetailPanel
                  metrics={selectedMetrics}
                  onClose={() => setSelectedMaterialId(null)}
                  onEditMaterial={() => setEditingMaterial(selectedMetrics.material)}
                  onDeleteMaterial={handleConfirmDeleteMaterial}
                  onAddStock={() => setIsAddingStock(true)}
                  onGeneratePdf={handleGeneratePdf}
                  isDeleting={isDeleting}
                  isGeneratingPdf={isGeneratingPdf}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Entrada de Estoque Físico */}
      {isAddingStock && (
        <StockEntryModal
          materials={rawMaterials}
          initialSelectedMaterialId={selectedMetrics?.material.id}
          onConfirm={handleConfirmStockEntry}
          onClose={() => setIsAddingStock(false)}
        />
      )}
    </div>
  );
}
