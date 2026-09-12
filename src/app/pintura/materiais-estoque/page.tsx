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

const ITEMS_PER_PAGE = 8;

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
  const [currentPage, setCurrentPage] = useState(1);

  // Estados de Filtros e Busca
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MaterialStockStatus | "todos">("todos");
  const [typeFilter, setTypeFilter] = useState("todos");

  // Tipos únicos extraídos da lista real de materiais
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    rawMaterials.forEach((m) => {
      if (m.type && m.type.trim()) types.add(m.type.trim());
    });
    return Array.from(types).sort();
  }, [rawMaterials]);

  // Lista filtrada respeitando busca e categorias reais
  const filteredMetrics = useMemo(() => {
    return planningMetricsList.filter((item: MaterialPlanningMetrics) => {
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchCode = item.material.code.toLowerCase().includes(query);
        const matchName = item.material.name.toLowerCase().includes(query);
        const matchType = item.material.type.toLowerCase().includes(query);
        const matchManuf = item.material.manufacturer?.toLowerCase().includes(query);
        if (!matchCode && !matchName && !matchType && !matchManuf) return false;
      }
      if (statusFilter !== "todos" && item.projectedStatus !== statusFilter) {
        return false;
      }
      if (typeFilter !== "todos" && item.material.type.toLowerCase() !== typeFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [planningMetricsList, search, statusFilter, typeFilter]);

  // Reset de página ao alterar busca ou filtros
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleTypeSelect = (type: string) => {
    setTypeFilter(type);
    setCurrentPage(1);
  };

  const handleStatusSelect = (status: MaterialStockStatus | "todos") => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Paginação
  const totalItems = filteredMetrics.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedMetrics = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredMetrics.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMetrics, safeCurrentPage]);

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
                Materiais de Pintura
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                RSS3
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {rawMaterials.length} {rawMaterials.length === 1 ? "item cadastrado" : "itens cadastrados"}
            </p>
          </div>
        </div>

        {/* Ações Rápidas do Topo */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <PermissionGate permission="materiais.criar">
            <button
              type="button"
              onClick={() => {
                setSelectedMetrics(null);
                setEditingMaterial(null);
                setIsCreatingMaterial(true);
              }}
              className="text-xs font-semibold px-3.5 py-2 bg-[#0c1524] hover:bg-blue-500/15 text-slate-200 rounded-lg border border-blue-500/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Novo Material</span>
            </button>
          </PermissionGate>

          <PermissionGate permission="estoque.movimentar">
            <button
              type="button"
              onClick={() => handleOpenAddStock()}
              className="text-xs font-bold px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] transition-all active:scale-95 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Entrada de Estoque</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 2. DIAGNÓSTICO DE ERRO REAL (se houver) */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* 3. FLUXO DE FORMULÁRIO (Criação/Edição) OU LISTAGEM */}
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

          {/* BARRA DE BUSCA E FILTROS INTEGRADA */}
          <div className="space-y-3">
            {/* Campo de Busca Principal */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar material, código ou fabricante..."
                className="w-full bg-[#0c1524] border border-blue-500/25 rounded-xl pl-11 pr-10 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-inner"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange("")}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                  title="Limpar busca"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Chips de Categorias Reais + Filtro de Situação */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              {/* Pills de Categorias Reais com rolagem horizontal se necessário */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs font-mono">
                <button
                  type="button"
                  onClick={() => handleTypeSelect("todos")}
                  className={`px-3 py-1.5 rounded-lg uppercase tracking-wider font-bold transition-all shrink-0 ${
                    typeFilter === "todos"
                      ? "bg-orange-500 text-white shadow-[0_0_12px_-2px_rgba(249,115,22,0.4)]"
                      : "bg-[#0c1524] text-slate-400 hover:text-white border border-blue-500/15 hover:border-blue-500/30"
                  }`}
                >
                  Todos
                </button>
                {availableTypes.map((t) => {
                  const isSelected = typeFilter.toLowerCase() === t.toLowerCase();
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeSelect(isSelected ? "todos" : t)}
                      className={`px-3 py-1.5 rounded-lg uppercase tracking-wider font-semibold transition-all shrink-0 ${
                        isSelected
                          ? "bg-orange-500 text-white shadow-[0_0_12px_-2px_rgba(249,115,22,0.4)]"
                          : "bg-[#0c1524] text-slate-400 hover:text-white border border-blue-500/15 hover:border-blue-500/30"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              {/* Filtro secundário: Situação Projetada */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Situação:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusSelect(e.target.value as MaterialStockStatus | "todos")}
                  className="bg-[#0c1524] border border-blue-500/20 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors font-mono"
                >
                  <option value="todos">Todas</option>
                  <option value="adequado">OK (Adequado)</option>
                  <option value="atencao">Atenção</option>
                  <option value="critico">Repor (Crítico)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Grid Principal: Lista de Cards + Painel Lateral de Detalhes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className={selectedMetrics ? "lg:col-span-2" : "lg:col-span-3"}>
              {isLoading ? (
                <div className="bg-[#0c1524] border border-blue-500/15 rounded-xl p-12 text-center text-slate-400 font-mono text-xs shadow-md">
                  Carregando dados de estoque e materiais...
                </div>
              ) : filteredMetrics.length === 0 ? (
                <div className="bg-[#0c1524] border border-blue-500/15 rounded-xl p-12 text-center text-slate-400 text-xs shadow-md space-y-2">
                  <p className="font-bold text-white text-sm">Nenhum material encontrado.</p>
                  <p className="text-slate-500">
                    Nenhum item corresponde aos critérios de pesquisa ou filtros selecionados.
                  </p>
                  {(search || typeFilter !== "todos" || statusFilter !== "todos") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setTypeFilter("todos");
                        setStatusFilter("todos");
                        setCurrentPage(1);
                      }}
                      className="mt-2 text-xs font-semibold px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 rounded border border-blue-500/30 transition-colors"
                    >
                      Limpar todos os filtros
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Lista de Cards Horizontais */}
                  {paginatedMetrics.map((metrics: MaterialPlanningMetrics) => (
                    <MaterialPlanningCard
                      key={metrics.material.id}
                      metrics={metrics}
                      isSelected={selectedMetrics?.material.id === metrics.material.id}
                      onSelect={(m) => setSelectedMetrics(m)}
                      onAdjustStock={(id) => handleOpenAddStock(id)}
                    />
                  ))}

                  {/* PAGINAÇÃO VISUAL */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-blue-500/10 text-xs font-mono">
                      <div className="text-slate-400">
                        Exibindo{" "}
                        <span className="font-bold text-white">
                          {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}–
                          {Math.min(safeCurrentPage * ITEMS_PER_PAGE, totalItems)}
                        </span>{" "}
                        de <span className="font-bold text-white">{totalItems}</span> itens
                      </div>

                      <div className="flex items-center gap-1.5 self-center sm:self-auto">
                        <button
                          type="button"
                          disabled={safeCurrentPage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="p-1.5 rounded-lg bg-[#0c1524] hover:bg-blue-500/15 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-500/15 transition-colors"
                          title="Página anterior"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                          </svg>
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((p) => {
                            return (
                              p === 1 ||
                              p === totalPages ||
                              (p >= safeCurrentPage - 1 && p <= safeCurrentPage + 1)
                            );
                          })
                          .map((p, idx, arr) => {
                            const prev = arr[idx - 1];
                            const showEllipsis = prev && p - prev > 1;
                            return (
                              <React.Fragment key={p}>
                                {showEllipsis && <span className="px-1 text-slate-500">...</span>}
                                <button
                                  type="button"
                                  onClick={() => setCurrentPage(p)}
                                  className={`w-8 h-8 rounded-lg font-bold transition-all text-xs ${
                                    safeCurrentPage === p
                                      ? "bg-orange-500 text-white shadow-[0_0_10px_-2px_rgba(249,115,22,0.5)]"
                                      : "bg-[#0c1524] text-slate-400 hover:text-white border border-blue-500/15 hover:border-blue-500/30"
                                  }`}
                                >
                                  {p}
                                </button>
                              </React.Fragment>
                            );
                          })}

                        <button
                          type="button"
                          disabled={safeCurrentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="p-1.5 rounded-lg bg-[#0c1524] hover:bg-blue-500/15 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-500/15 transition-colors"
                          title="Próxima página"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Painel Lateral de Detalhes Completo */}
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
