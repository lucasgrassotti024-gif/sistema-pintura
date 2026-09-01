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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Atividades & Frentes de Trabalho
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Controle operacional, apontamentos e monitoramento de cronogramas de pintura industrial.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/pintura/historico"
            className="text-xs font-semibold px-3 py-2 bg-[#0f172a] hover:bg-white/5 text-slate-300 rounded-md border border-white/10 hover:border-white/20 transition-colors"
          >
            📋 Histórico Geral
          </Link>
          
          <div className="text-xs font-mono px-3 py-2 bg-[#0f172a] text-slate-400 rounded-md border border-white/10">
            Total: <span className="text-slate-100 font-bold">{rawActivities.length}</span> | Filtradas: <span className="text-emerald-400 font-bold">{activities.length}</span>
          </div>

          <PermissionGate permission="atividades.criar">
            <button
              type="button"
              onClick={() => {
                setSelectedActivity(null);
                setIsCreating(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] transition-all active:scale-95"
            >
              <span>+</span> Adicionar atividade
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase font-mono">Aviso do Banco:</span>
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
                <div className="p-12 text-center text-slate-400 bg-[#0f172a] border border-white/5 rounded-lg flex flex-col items-center justify-center gap-3">
                  <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
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
