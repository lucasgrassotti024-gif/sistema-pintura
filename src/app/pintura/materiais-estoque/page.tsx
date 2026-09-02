"use client";

import React, { useState, useMemo } from "react";
import { useMaterials } from "@/modules/materiais/hooks/useMaterials";
import { MaterialPlanningSummaryCards } from "@/modules/materiais/components/MaterialPlanningSummaryCards";
import { MaterialPlanningCard } from "@/modules/materiais/components/MaterialPlanningCard";
import { MaterialPlanningDetailPanel } from "@/modules/materiais/components/MaterialPlanningDetailPanel";
import { MaterialForm } from "@/modules/materiais/components/MaterialForm";
import { StockEntryModal } from "@/modules/materiais/components/StockEntryModal";
import { MaterialPlanningMetrics, MaterialStockStatus, Material, NewMaterialInput, StockEntryInput } from "@/modules/materiais/types/material.types";
import { PermissionGate } from "@/components/auth/PermissionGate";

export default function MateriaisEstoquePage() {
  const {
    rawMaterials,
    planningMetricsList,
    summary,
    isLoading,
    error,
    addNewMaterial,
    editMaterial,
    removeMaterial,
    addStockEntry,
  } = useMaterials();

  // Estados de Controle de Interface
  const [selectedMetrics, setSelectedMetrics] = useState<MaterialPlanningMetrics | null>(null);
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [stockEntryTargetMaterialId, setStockEntryTargetMaterialId] = useState<string | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados de Filtros e Busca
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MaterialStockStatus | "todos">("todos");
  const [typeFilter, setTypeFilter] = useState("todos");

  // Tipos únicos extraídos da lista real
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    rawMaterials.forEach((m) => {
      if (m.type) types.add(m.type);
    });
    return Array.from(types).sort();
  }, [rawMaterials]);

  // Lista filtrada
  const filteredMetrics = useMemo(() => {
    return planningMetricsList.filter((item: MaterialPlanningMetrics) => {
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchCode = item.material.code.toLowerCase().includes(query);
        const matchName = item.material.name.toLowerCase().includes(query);
        const matchType = item.material.type.toLowerCase().includes(query);
        const matchManuf = item.material.manufacturer?.toLowerCase().includes(query);
        if (!matchCode && !matchName && !matchType && !matchManuf) return false;
      }
      if (statusFilter !== "todos" && item.projectedStatus !== statusFilter) {
        return false;
      }
      if (typeFilter !== "todos" && item.material.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [planningMetricsList, search, statusFilter, typeFilter]);

  // Handlers
  const handleOpenAddStock = (materialId?: string) => {
    setStockEntryTargetMaterialId(materialId);
    setIsAddingStock(true);
  };

  const handleSaveMaterial = async (data: NewMaterialInput & { active?: boolean }) => {
    if (editingMaterial) {
      await editMaterial(editingMaterial.id, data);
      setEditingMaterial(null);
    } else {
      await addNewMaterial(data);
      setIsCreatingMaterial(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    setIsDeleting(true);
    try {
      await removeMaterial(materialId);
      setSelectedMetrics(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmStockEntry = async (entry: StockEntryInput) => {
    await addStockEntry(entry);
    setIsAddingStock(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-blue-500/15">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Planejamento de Tintas & Estoque
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
              Controle Operacional RSS3
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Controle de saldo físico, demandas programadas e projeção de consumo das ordens de serviço.
          </p>
        </div>

        {/* Ações Rápidas */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <PermissionGate permission="materiais.criar">
            <button
              type="button"
              onClick={() => {
                setSelectedMetrics(null);
                setEditingMaterial(null);
                setIsCreatingMaterial(true);
              }}
              className="text-xs font-semibold px-3 py-2 bg-[#0c1524] hover:bg-blue-500/15 text-slate-200 rounded border border-blue-500/20 transition-colors"
            >
              + Novo Catálogo
            </button>
          </PermissionGate>

          <PermissionGate permission="estoque.movimentar">
            <button
              type="button"
              onClick={() => handleOpenAddStock()}
              className="text-xs font-bold px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Adicionar Material</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 2. DIAGNÓSTICO DE ERRO REAL (se houver) */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* 3. FLUXO DE FORMULÁRIO (Criação/Edição) OU LISTAGEM COMPLETA */}
      {isCreatingMaterial || editingMaterial ? (
        <div className="flex justify-center py-2">
          <MaterialForm
            initialMaterial={editingMaterial}
            onSave={handleSaveMaterial}
            onCancel={() => {
              setIsCreatingMaterial(false);
              setEditingMaterial(null);
            }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cards de Resumo Consolidado do Topo */}
          <MaterialPlanningSummaryCards summary={summary} />

          {/* Barra de Filtros e Busca */}
          <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-md text-xs">
            <div>
              <label className="block text-slate-400 font-mono mb-1.5 uppercase tracking-wide">
                Buscar Insumo (Código, Nome, Fabricante)
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar materiais..."
                className="w-full bg-[#070c14] border border-blue-500/20 rounded-md px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1.5 uppercase tracking-wide">
                Situação Projetada
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as MaterialStockStatus | "todos")}
                className="w-full bg-[#070c14] border border-blue-500/20 rounded-md px-3 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              >
                <option value="todos">Todas as Situações</option>
                <option value="adequado">Adequado</option>
                <option value="atencao">Atenção</option>
                <option value="critico">Crítico / Insuficiente</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1.5 uppercase tracking-wide">
                Tipo / Família
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-[#070c14] border border-blue-500/20 rounded-md px-3 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              >
                <option value="todos">Todos os Tipos ({availableTypes.length})</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Principal: Lista de Cards + Painel Lateral de Detalhes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className={selectedMetrics ? "lg:col-span-2" : "lg:col-span-3"}>
              {isLoading ? (
                <div className="bg-[#0c1524] border border-blue-500/15 rounded-lg p-12 text-center text-slate-400 font-mono text-xs shadow-md">
                  Carregando dados de estoque e materiais...
                </div>
              ) : filteredMetrics.length === 0 ? (
                <div className="bg-[#0c1524] border border-blue-500/15 rounded-lg p-12 text-center text-slate-400 text-xs shadow-md space-y-1">
                  <p className="font-semibold text-white">Nenhum material encontrado.</p>
                  <p className="text-[11px] text-slate-500">Verifique os filtros selecionados ou cadastre um novo item no catálogo.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMetrics.map((metrics: MaterialPlanningMetrics) => (
                    <MaterialPlanningCard
                      key={metrics.material.id}
                      metrics={metrics}
                      isSelected={selectedMetrics?.material.id === metrics.material.id}
                      onSelect={(m) => setSelectedMetrics(m)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Painel Lateral de Detalhes */}
            {selectedMetrics && (
              <div className="lg:col-span-1 sticky top-20">
                <MaterialPlanningDetailPanel
                  metrics={selectedMetrics}
                  onClose={() => setSelectedMetrics(null)}
                  onEditMaterial={() => setEditingMaterial(selectedMetrics.material)}
                  onDeleteMaterial={() => handleDeleteMaterial(selectedMetrics.material.id)}
                  onAddStock={() => handleOpenAddStock(selectedMetrics.material.id)}
                  isDeleting={isDeleting}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Entrada de Estoque */}
      {isAddingStock && (
        <StockEntryModal
          materials={rawMaterials.filter((m) => m.active)}
          initialSelectedMaterialId={stockEntryTargetMaterialId}
          onConfirm={handleConfirmStockEntry}
          onClose={() => setIsAddingStock(false)}
        />
      )}
    </div>
  );
}
