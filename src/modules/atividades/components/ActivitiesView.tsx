"use client";

import React, { useState } from "react";
import { useActivities } from "../hooks/useActivities";
import { ActivityList } from "./ActivityList";
import { ActivityFilters } from "./ActivityFilters";
import { ActivityDetails } from "./ActivityDetails";
import { ActivityForm } from "./ActivityForm";
import { Activity } from "../types/activity.types";
import { PermissionGate } from "@/components/auth/PermissionGate";

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

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Frentes de Trabalho & Ordens de Serviço
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Operacional RSS3
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão operacional em tempo real de ordens de serviço, progresso e consumos na planta industrial.
          </p>
        </div>

        {/* Botão de Criação de Atividade */}
        {!isCreating && !editingActivity && (
          <PermissionGate permission="atividades.criar">
            <button
              type="button"
              onClick={() => {
                setSelectedActivity(null);
                setIsCreating(true);
              }}
              className="text-xs font-bold px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md shadow-xs transition-all active:scale-95 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>+</span>
              <span>Adicionar atividade</span>
            </button>
          </PermissionGate>
        )}
      </div>

      {/* 2. DIAGNÓSTICO DE ERRO REAL (se houver) */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 font-mono">
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
