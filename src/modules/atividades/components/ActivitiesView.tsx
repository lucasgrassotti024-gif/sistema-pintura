"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useActivities } from "../hooks/useActivities";
import { ActivityList } from "./ActivityList";
import { ActivityFilters } from "./ActivityFilters";
import { ActivityDetails } from "./ActivityDetails";
import { ActivityForm } from "./ActivityForm";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Activity } from "../types/activity.types";

export function ActivitiesView() {
  const {
    activities,
    rawActivities,
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

  const handleSaveActivity = async (activityToSave: Activity) => {
    if (editingActivity) {
      await updateActivity(activityToSave);
      setEditingActivity(null);
      setIsCreating(false);
    } else {
      await addActivity(activityToSave);
      setIsCreating(false);
    }
  };

  const handleStartEdit = (act: Activity) => {
    setEditingActivity(act);
    setIsCreating(true);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-blue-500/15 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              Atividades & Frentes de Trabalho
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Controle operacional, apontamentos e monitoramento de cronogramas de pintura industrial RSS3.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/pintura/historico"
            className="text-xs font-semibold px-3 py-2 bg-[#0c1524] hover:bg-blue-500/10 text-slate-300 rounded-md border border-blue-500/20 hover:border-blue-500/40 transition-colors"
          >
            📋 Histórico Geral
          </Link>
          
          <div className="text-xs font-mono px-3 py-2 bg-[#0c1524] text-slate-400 rounded-md border border-blue-500/20">
            Total: <span className="text-white font-bold">{rawActivities.length}</span> | Filtradas: <span className="text-orange-400 font-bold">{activities.length}</span>
          </div>

          <PermissionGate permission="atividades.criar">
            <button
              type="button"
              onClick={() => {
                setSelectedActivity(null);
                setIsCreating(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-md shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] transition-all active:scale-95"
            >
              <span>+</span> Adicionar atividade
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/25 text-rose-300 px-4 py-3 rounded-lg text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase">Aviso do Banco:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Formulário de Criação ou Edição de Atividade */}
      {isCreating ? (
        <ActivityForm
          initialActivity={editingActivity}
          onSave={handleSaveActivity}
          onCancel={() => {
            setIsCreating(false);
            setEditingActivity(null);
          }}
        />
      ) : (
        <>
          {/* Painel de Filtros e Busca */}
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

          {/* Grid de Conteúdo Principal */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={selectedActivity ? "lg:col-span-2" : "lg:col-span-3"}>
              {isLoading ? (
                <div className="p-12 text-center text-slate-400 bg-[#0c1524] border border-blue-500/15 rounded-lg flex flex-col items-center justify-center gap-3">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono">Sincronizando atividades reais do Supabase...</span>
                </div>
              ) : (
                <ActivityList
                  activities={activities}
                  onSelectActivity={(act) => {
                    setIsCreating(false);
                    setEditingActivity(null);
                    setSelectedActivity(act);
                  }}
                />
              )}
            </div>

            {/* Painel de Detalhes Lateral (quando selecionado) */}
            {selectedActivity && (
              <div className="lg:col-span-1">
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
        </>
      )}
    </div>
  );
}
