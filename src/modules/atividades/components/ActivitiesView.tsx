"use client";

import React, { useState } from "react";
import { useActivities } from "../hooks/useActivities";
import { ActivityList } from "./ActivityList";
import { ActivityFilters } from "./ActivityFilters";
import { ActivityDetails } from "./ActivityDetails";
import { ActivityForm } from "./ActivityForm";
import { Activity } from "../types/activity.types";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { exportActivitiesToExcel } from "../utils/excel-export.utils";
import { generateActivitiesPdf } from "../services/activity-pdf.service";

export function ActivitiesView() {
  const {
    activities,
    selectedActivity,
    setSelectedActivity,
    isLoading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    areaFilter,
    setAreaFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    sortOrder,
    toggleSortOrder,
    availableAreas,
    addActivity,
    updateActivity,
    archiveActivity,
  } = useActivities();

  const [isCreating, setIsCreating] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [viewingActivity, setViewingActivity] = useState<Activity | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleToggleSelectActivity = (activityId: string) => {
    setSelectedActivityIds((prev) =>
      prev.includes(activityId)
        ? prev.filter((id) => id !== activityId)
        : [...prev, activityId]
    );
  };

  const handleSelectAllVisible = (selectAll: boolean) => {
    if (selectAll) {
      // Adiciona todas as atividades atualmente visíveis na tela aos selecionados sem duplicar
      const visibleIds = activities.map((a) => a.id);
      setSelectedActivityIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    } else {
      // Desmarca somente as atividades atualmente visíveis na tela
      const visibleIdSet = new Set(activities.map((a) => a.id));
      setSelectedActivityIds((prev) => prev.filter((id) => !visibleIdSet.has(id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedActivityIds([]);
  };

  const handleGenerateSelectedPdf = async () => {
    if (selectedActivityIds.length === 0 || isGeneratingPdf) return;

    // Filtra rigorosamente as atividades selecionadas
    const selectedActivities = activities.filter((a) =>
      selectedActivityIds.includes(a.id)
    );

    if (selectedActivities.length === 0) {
      setExportWarning("Nenhuma das atividades selecionadas está disponível no momento.");
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setExportWarning(null);
      await generateActivitiesPdf(selectedActivities, { includePhotos: true });
    } catch (err) {
      console.error("Erro ao gerar PDF conjunto:", err);
      setExportWarning("Ocorreu um erro ao gerar o PDF das atividades selecionadas.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSaveNew = async (activityData: Activity) => {
    await addActivity(activityData);
    setIsCreating(false);
  };

  const handleStartEdit = (activity: Activity) => {
    setViewingActivity(null);
    setEditingActivity(activity);
  };

  const handleViewDetails = (activity: Activity) => {
    setEditingActivity(null);
    setViewingActivity(activity);
  };

  const handleSaveEdit = async (updated: Activity) => {
    await updateActivity(updated);
    setEditingActivity(null);
  };

  const handleExportExcel = () => {
    setExportWarning(null);
    if (!activities || activities.length === 0) {
      setExportWarning("Não existem atividades para exportar com os filtros atuais selecionados.");
      return;
    }

    try {
      setIsExporting(true);
      const success = exportActivitiesToExcel(activities, {
        search,
        statusFilter,
        areaFilter,
        startDate,
        endDate,
      });
      if (!success) {
        setExportWarning("Não foi possível gerar a planilha Excel. Verifique se há registros na tela.");
      }
    } catch (err) {
      console.error("Erro ao gerar planilha Excel:", err);
      setExportWarning("Ocorreu um erro ao gerar a planilha Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-blue-500/15">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Frentes de Trabalho & Ordens de Serviço
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
              Operacional RSS3
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestão operacional em tempo real de ordens de serviço, progresso e consumos na planta industrial.
          </p>
        </div>

        {/* Ações do Cabeçalho: Exportar Excel e Nova Atividade */}
        {!isCreating && !editingActivity && !viewingActivity && (
          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
            {/* Botão Exportar Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              title="Exportar as atividades filtradas da tela para planilha Excel (.xlsx)"
              className="text-xs font-semibold px-3.5 py-2 bg-[var(--bg-surface)] hover:bg-blue-500/10 text-slate-700 dark:text-slate-200 border border-[var(--border-medium)] hover:border-blue-500/40 rounded-md transition-all active:scale-95 flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span>Exportando...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Exportar Excel</span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-base)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                    {activities.length}
                  </span>
                </>
              )}
            </button>

            {/* Botão de Criação de Atividade */}
            <PermissionGate permission="atividades.criar">
              <button
                type="button"
                onClick={() => {
                  setSelectedActivity(null);
                  setIsCreating(true);
                }}
                className="text-xs font-bold px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Adicionar atividade</span>
              </button>
            </PermissionGate>
          </div>
        )}
      </div>

      {/* Alerta de Exportação Vazia (se acionado sem resultados) */}
      {exportWarning && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center justify-between">
          <span>{exportWarning}</span>
          <button
            type="button"
            onClick={() => setExportWarning(null)}
            className="text-amber-500 hover:text-amber-700 dark:hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. DIAGNÓSTICO DE ERRO REAL (se houver) */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* 3. FLUXO DE FORMULÁRIO (Criação / Edição / Visualização) OU LISTA OPERACIONAL */}
      {isCreating ? (
        <div className="py-2">
          <ActivityForm
            onSave={handleSaveNew}
            onCancel={() => setIsCreating(false)}
          />
        </div>
      ) : editingActivity ? (
        <div className="py-2">
          <ActivityForm
            initialActivity={editingActivity}
            onSave={handleSaveEdit}
            onCancel={() => setEditingActivity(null)}
          />
        </div>
      ) : viewingActivity ? (
        <div className="py-2">
          <ActivityForm
            initialActivity={viewingActivity}
            readOnly={true}
            onSave={async () => {}}
            onCancel={() => setViewingActivity(null)}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Barra de Filtros Operacionais */}
          <ActivityFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            areaFilter={areaFilter}
            onAreaChange={setAreaFilter}
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
            sortOrder={sortOrder}
            onSortOrderToggle={toggleSortOrder}
            availableAreas={availableAreas}
          />

          {/* Barra de Ações para Atividades Selecionadas */}
          {selectedActivityIds.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-blue-950/40 dark:bg-blue-950/60 border border-blue-500/30 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs font-semibold text-slate-100 font-mono">
                  {selectedActivityIds.length}{" "}
                  {selectedActivityIds.length === 1
                    ? "atividade selecionada"
                    : "atividades selecionadas"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Botão Gerar PDF das Selecionadas */}
                <button
                  type="button"
                  onClick={handleGenerateSelectedPdf}
                  disabled={isGeneratingPdf}
                  className="text-xs font-semibold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-xs transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isGeneratingPdf ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Gerando PDF...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5 text-orange-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span>Gerar PDF das selecionadas</span>
                    </>
                  )}
                </button>

                {/* Botão Limpar Seleção */}
                <button
                  type="button"
                  onClick={handleClearSelection}
                  disabled={isGeneratingPdf}
                  className="text-xs font-semibold px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded transition-colors cursor-pointer disabled:opacity-50"
                >
                  Limpar
                </button>
              </div>
            </div>
          )}

          {/* Grid Principal: Lista/Tabela + Painel Lateral de Detalhes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className={selectedActivity ? "lg:col-span-2" : "lg:col-span-3"}>
              <ActivityList
                activities={activities}
                selectedActivity={selectedActivity}
                onSelectActivity={setSelectedActivity}
                isLoading={isLoading}
                selectedActivityIds={selectedActivityIds}
                onToggleSelectActivity={handleToggleSelectActivity}
                onSelectAllActivities={handleSelectAllVisible}
              />
            </div>

            {selectedActivity && (
              <div className="lg:col-span-1 sticky top-20">
                <ActivityDetails
                  activity={selectedActivity}
                  onUpdateActivity={updateActivity}
                  onStartEdit={handleStartEdit}
                  onViewDetails={handleViewDetails}
                  onArchiveActivity={archiveActivity}
                  onClose={() => setSelectedActivity(null)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
