"use client";

import React, { useState } from "react";
import { useMaterials } from "@/modules/materiais/hooks/useMaterials";
import { Material, MaterialStockStatus, NewMaterialInput, StockEntryInput } from "@/modules/materiais/types/material.types";
import { MaterialForm } from "@/modules/materiais/components/MaterialForm";
import { StockEntryModal } from "@/modules/materiais/components/StockEntryModal";
import { PermissionGate } from "@/components/auth/PermissionGate";

import { generateMaterialPdf } from "@/modules/materiais/services/material-pdf.service";

export default function MateriaisEstoquePage() {
  const {
    materials,
    rawMaterials,
    selectedMaterial,
    setSelectedMaterial,
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
    if (!selectedMaterial) return;
    const confirmMsg = `Deseja realmente inativar o material "${selectedMaterial.name}"?\n\nEle será desativado do catálogo para novos lançamentos, mas seu histórico de estoque e consumo será preservado integralmente.`;
    if (window.confirm(confirmMsg)) {
      setIsDeleting(true);
      try {
        await removeMaterial(selectedMaterial.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao inativar material.");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleGeneratePdf = async () => {
    if (!selectedMaterial) return;
    setIsGeneratingPdf(true);
    try {
      await generateMaterialPdf(selectedMaterial);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao gerar PDF do material.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Badges discretos no tema Dark Premium Industrial (sem poluir a interface)
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
            Crítico
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Catálogo & Estoque de Materiais
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestão técnica do catálogo de tintas, controle de saldo físico e monitoramento de estoque mínimo.
          </p>
        </div>

        {/* Grupo de Ações no Cabeçalho */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs font-mono font-medium px-2.5 py-1.5 bg-[#0f172a] text-slate-400 rounded border border-white/10">
            Total: {rawMaterials.length} | Filtrados: {materials.length}
          </span>

          {/* Botão: Novo Material (Cadastro no Catálogo) */}
          <PermissionGate permission="materiais.criar">
            <button
              type="button"
              onClick={() => {
                setSelectedMaterial(null);
                setEditingMaterial(null);
                setIsCreatingMaterial(true);
              }}
              className="text-xs font-semibold px-3 py-1.5 bg-[#090d16] hover:bg-white/5 text-slate-200 rounded-md border border-white/10 hover:border-white/20 transition-colors"
            >
              + Novo material
            </button>
          </PermissionGate>

          {/* Botão: Adicionar Material (Entrada de Estoque Físico) */}
          <PermissionGate permission="estoque.movimentar">
            <button
              type="button"
              onClick={() => setIsAddingStock(true)}
              className="text-xs font-bold px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md shadow-[0_0_12px_-2px_rgba(16,185,129,0.4)] transition-colors"
            >
              + Adicionar material
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300">
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
          {/* Filtros e Busca */}
          <div className="bg-[#0f172a] border border-white/10 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-md">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Buscar no Catálogo (Código, Nome, Tipo)
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por código, especificação ou tipo..."
                className="w-full text-xs bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Situação do Estoque
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
              >
                <option value="todos">Todas as Situações</option>
                <option value="adequado">Adequado</option>
                <option value="atencao">Atenção</option>
                <option value="critico">Crítico (Abaixo do Mínimo)</option>
              </select>
            </div>
          </div>

          {/* Grid Principal: Tabela de Materiais + Painel de Detalhes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={selectedMaterial ? "lg:col-span-2 space-y-3" : "lg:col-span-3 space-y-3"}>
              {/* 1. VISUALIZAÇÃO EM CARDS (MOBILE < 768px) */}
              <div className="md:hidden space-y-3">
                {isLoading ? (
                  <div className="p-8 text-center text-slate-400 font-mono text-xs bg-[#0f172a] rounded-lg border border-white/10">
                    Carregando catálogo de materiais do Supabase...
                  </div>
                ) : materials.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs bg-[#0f172a] rounded-lg border border-white/10">
                    Nenhum material encontrado com os filtros aplicados.
                  </div>
                ) : (
                  materials.map((m) => {
                    const isSelected = selectedMaterial?.id === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMaterial(m)}
                        className={`p-4 rounded-lg border bg-[#0f172a] shadow-sm transition-all cursor-pointer space-y-2.5 ${
                          isSelected
                            ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-mono font-bold text-emerald-400 text-xs">{m.code}</span>
                          {getStatusBadge(m.status)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100 text-xs leading-snug">{m.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {m.type} {m.manufacturer ? `• ${m.manufacturer}` : ""} {m.color ? `• ${m.color}` : ""}
                          </p>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5 font-mono">
                          <span className="text-slate-300">
                            Saldo: <strong className="text-emerald-400">{m.currentStock} {m.unit}</strong>
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            Mín: {m.minimumStock} {m.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 2. VISUALIZAÇÃO EM TABELA TÉCNICA (DESKTOP >= 768px) */}
              <div className="hidden md:block overflow-x-auto border border-white/10 rounded-lg bg-[#0f172a] shadow-md">
                <table className="min-w-full divide-y divide-white/10 text-left text-xs">
                  <thead className="bg-[#090d16] text-slate-400 font-mono font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Material / Tipo</th>
                      <th className="py-3 px-4">Estoque Atual</th>
                      <th className="py-3 px-4">Estoque Mínimo</th>
                      <th className="py-3 px-4">Situação</th>
                      <th className="py-3 px-4">Localização</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-[#0f172a]">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-mono">
                          Carregando catálogo de materiais do Supabase...
                        </td>
                      </tr>
                    ) : materials.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          Nenhum material encontrado com os filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      materials.map((m) => {
                        const isSelected = selectedMaterial?.id === m.id;
                        return (
                          <tr
                            key={m.id}
                            onClick={() => setSelectedMaterial(m)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-emerald-500/10"
                                : "hover:bg-white/5"
                            }`}
                          >
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                              {m.code}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-100 leading-tight">{m.name}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {m.type} {m.manufacturer ? `• ${m.manufacturer}` : ""} {m.color ? `• ${m.color}` : ""}
                              </p>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-100">
                                {m.currentStock} {m.unit}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                              {m.minimumStock} {m.unit}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {getStatusBadge(m.status)}
                            </td>
                            <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                              {m.location || "-"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Painel Lateral de Detalhes do Material Selecionado */}
            {selectedMaterial && (
              <div className="lg:col-span-1 bg-[#0f172a] border border-white/10 rounded-lg p-5 space-y-4 shadow-md">
                {/* 1. CABEÇALHO (Código à esquerda e Botão Fechar no canto superior direito) */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">
                      {selectedMaterial.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-100 mt-0.5 leading-snug">
                      {selectedMaterial.name}
                    </h3>
                  </div>

                  {/* Botão Fechar no Canto Superior Direito */}
                  <button
                    type="button"
                    onClick={() => setSelectedMaterial(null)}
                    className="text-slate-400 hover:text-slate-200 text-xs px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors"
                  >
                    Fechar
                  </button>
                </div>

                {/* 2. ÁREA DE AÇÕES (Abaixo do título) */}
                <div className="flex items-center gap-2 flex-wrap border-b border-white/5 pb-3 pt-1">
                  {/* Editar */}
                  <PermissionGate permission="materiais.editar">
                    <button
                      type="button"
                      onClick={() => setEditingMaterial(selectedMaterial)}
                      className="text-xs font-semibold px-2.5 py-1 bg-[#090d16] hover:bg-white/5 text-slate-200 rounded border border-white/10 hover:border-white/20 transition-colors"
                    >
                      Editar
                    </button>
                  </PermissionGate>

                  {/* Excluir (Inativação Rastreável) */}
                  <PermissionGate permission="materiais.editar">
                    <button
                      type="button"
                      onClick={handleConfirmDeleteMaterial}
                      disabled={isDeleting}
                      className="text-xs font-semibold px-2.5 py-1 bg-[#090d16] hover:bg-rose-500/10 text-rose-300 rounded border border-rose-500/30 hover:border-rose-500/50 transition-colors"
                    >
                      {isDeleting ? "Inativando..." : "Excluir"}
                    </button>
                  </PermissionGate>

                  {/* Gerar PDF */}
                  <button
                    type="button"
                    onClick={handleGeneratePdf}
                    disabled={isGeneratingPdf}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-[#090d16] hover:bg-white/5 text-emerald-400 rounded border border-emerald-500/30 hover:border-emerald-500/50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>{isGeneratingPdf ? "Gerando..." : "Gerar PDF"}</span>
                  </button>
                </div>

                {/* 3. STATUS E CATEGORIA (Badges informativos não clicáveis) */}
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(selectedMaterial.status)}
                  <span className="text-xs text-slate-400 font-mono">{selectedMaterial.type}</span>
                  {!selectedMaterial.active && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[#090d16] text-slate-400 border border-white/10">
                      Inativo
                    </span>
                  )}
                </div>

                {/* 4. BLOCO DE INFORMAÇÕES PRINCIPAIS (Rótulo vs Valor) */}
                <div className="bg-[#090d16] border border-white/5 rounded-md p-3.5 space-y-2 text-xs">
                  {selectedMaterial.manufacturer && (
                    <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                      <span className="text-slate-400 font-mono">Fabricante:</span>
                      <span className="font-semibold text-slate-200">{selectedMaterial.manufacturer}</span>
                    </div>
                  )}
                  {selectedMaterial.color && (
                    <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                      <span className="text-slate-400 font-mono">Cor / Padrão:</span>
                      <span className="font-semibold text-slate-200">{selectedMaterial.color}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                    <span className="text-slate-400 font-mono">Saldo em Estoque:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {selectedMaterial.currentStock} {selectedMaterial.unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                    <span className="text-slate-400 font-mono">Ponto de Pedido (Mínimo):</span>
                    <span className="font-mono text-slate-300">
                      {selectedMaterial.minimumStock} {selectedMaterial.unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-mono">Localização:</span>
                    <span className="text-slate-200">{selectedMaterial.location || "-"}</span>
                  </div>
                </div>

                {selectedMaterial.technicalInfo && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                      Informações Técnicas
                    </h4>
                    <p className="text-xs text-slate-300 bg-[#090d16] p-3 rounded border border-white/5 leading-relaxed">
                      {selectedMaterial.technicalInfo}
                    </p>
                  </div>
                )}

                {/* Ação Operacional Principal (Entrada de Estoque) */}
                <div className="pt-2">
                  <PermissionGate permission="estoque.movimentar">
                    <button
                      type="button"
                      onClick={() => setIsAddingStock(true)}
                      className="w-full text-xs font-bold py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-[0_0_12px_-2px_rgba(16,185,129,0.4)] transition-colors"
                    >
                      + Registrar Entrada de Estoque
                    </button>
                  </PermissionGate>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Entrada de Estoque */}
      {isAddingStock && (
        <StockEntryModal
          materials={rawMaterials}
          initialSelectedMaterialId={selectedMaterial?.id}
          onConfirm={handleConfirmStockEntry}
          onClose={() => setIsAddingStock(false)}
        />
      )}
    </div>
  );
}
