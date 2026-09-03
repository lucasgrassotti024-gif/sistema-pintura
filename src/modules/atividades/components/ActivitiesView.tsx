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
  const [isExporting, setIsExporting] = useState(false);
  const [exportWarning, setExportWarning] = useState<string | null>(null);

  const handleSaveNew = async (activityData: Activity) => {
    await addActivity(activityData);
    setIsCreating(false);
  };

  const handleStartEdit = (activity: Activity) => {
    setEditingActivity(activity);
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
      const success = exportActivitiesToExcel(activities);
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
        {!isCreating && !editingActivity && (
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

      {/* 3. FLUXO DE FORMULÁRIO (Criação / Edição) OU LISTA OPERACIONAL */}
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

          {/* Grid Principal: Lista/Tabela + Painel Lateral de Detalhes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className={selectedActivity ? "lg:col-span-2" : "lg:col-span-3"}>
              <ActivityList
                activities={activities}
                selectedActivity={selectedActivity}
                onSelectActivity={setSelectedActivity}
                isLoading={isLoading}
              />
            </div>

            {selectedActivity && (
              <div className="lg:col-span-1 sticky top-20">
                <ActivityDetails
                  activity={selectedActivity}
                  onUpdateActivity={updateActivity}
                  onStartEdit={handleStartEdit}
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
