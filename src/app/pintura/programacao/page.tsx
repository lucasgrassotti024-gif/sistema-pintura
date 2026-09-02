"use client";

import React, { useState } from "react";
import { useActivities } from "@/modules/atividades/hooks/useActivities";
import { ActivityDetails } from "@/modules/atividades/components/ActivityDetails";
import { ActivityForm } from "@/modules/atividades/components/ActivityForm";
import { isActivityDelayed } from "@/modules/atividades/rules/activity.rules";
import { Activity } from "@/modules/atividades/types/activity.types";
import { getWeekInfo, formatDateISO } from "@/modules/atividades/utils/week.utils";

export default function ProgramacaoPage() {
  const {
    rawActivities,
    selectedActivity,
    setSelectedActivity,
    isLoading,
    error,
    updateActivity,
    archiveActivity,
  } = useActivities();

  // Estado da data de referência para navegação semanal
  const [currentReferenceDate, setCurrentReferenceDate] = useState<Date>(new Date());
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  // Calcula os dias da semana (Segunda a Sexta por padrão)
  const weekInfo = getWeekInfo(currentReferenceDate, false);

  // Navegação semanal
  const handlePreviousWeek = () => {
    const prev = new Date(currentReferenceDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentReferenceDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentReferenceDate);
    next.setDate(next.getDate() + 7);
    setCurrentReferenceDate(next);
  };

  const handleCurrentWeek = () => {
    setCurrentReferenceDate(new Date());
  };

  const handleStartEdit = (act: Activity) => {
    setEditingActivity(act);
  };

  const handleSaveEdit = async (updated: Activity) => {
    await updateActivity(updated);
    setEditingActivity(null);
  };

  // Atividades reais que interceptam o dia (plannedStartDate <= day <= plannedEndDate)
  const getActivitiesForDay = (dayStr: string) => {
    return rawActivities.filter((act) => {
      return act.schedule.plannedStartDate <= dayStr && act.schedule.plannedEndDate >= dayStr;
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-blue-500/15 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Programação Operacional
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Quadro semanal de ordens de serviço, frentes ativas e distribuição de equipes RSS3.
          </p>
        </div>

        {/* Navegação Semanal */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-[#0c1524] border border-blue-500/20 rounded-md overflow-hidden">
            <button
              type="button"
              onClick={handlePreviousWeek}
              title="Semana anterior"
              className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:bg-blue-500/10 border-r border-blue-500/20 transition-colors"
            >
              ←
            </button>
            <button
              type="button"
              onClick={handleCurrentWeek}
              title="Ir para semana atual"
              className="px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-blue-500/10 transition-colors"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              title="Próxima semana"
              className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:bg-blue-500/10 border-l border-blue-500/20 transition-colors"
            >
              →
            </button>
          </div>

          <span className="text-xs font-mono font-bold px-3 py-1 bg-orange-500/15 border border-orange-500/35 text-orange-400 rounded">
            {weekInfo.label}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-xs font-mono">
          Carregando programação semanal do Supabase...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Painel do Calendário Semanal */}
          <div className={selectedActivity ? "lg:col-span-2 space-y-4" : "lg:col-span-3 space-y-4"}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {weekInfo.days.map((day) => {
                const dayActivities = getActivitiesForDay(day.date);
                const todayISO = formatDateISO(new Date());

                return (
                  <div
                    key={day.date}
                    className={`bg-[#0c1524] border rounded-lg p-3 flex flex-col min-h-[120px] md:min-h-[380px] transition-all shadow-sm ${
                      day.isToday
                        ? "border-orange-500/60 shadow-[0_0_15px_rgba(249,115,22,0.2)] ring-1 ring-orange-500/40"
                        : "border-blue-500/15"
                    }`}
                  >
                    {/* Cabeçalho do Dia */}
                    <div className="border-b border-blue-500/15 pb-2 mb-3">
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-bold ${day.isToday ? "text-orange-400 font-mono" : "text-slate-200"}`}>
                          {day.dayOfWeek}
                        </span>
                        {day.isToday && (
                          <span className="text-[9px] uppercase font-bold bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/40 font-mono">
                            Hoje
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{day.label}</span>
                    </div>

                    {/* Lista de Atividades do Dia */}
                    <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                      {dayActivities.length === 0 ? (
                        <p className="text-[11px] text-slate-500 text-center py-10 font-mono">Sem atividades</p>
                      ) : (
                        dayActivities.map((act) => {
                          const delayed = isActivityDelayed(act, todayISO);
                          const isSelected = selectedActivity?.id === act.id;

                          return (
                            <div
                              key={act.id}
                              onClick={() => setSelectedActivity(act)}
                              className={`p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-orange-500/15 border-orange-500 ring-1 ring-orange-500"
                                  : delayed
                                  ? "bg-rose-500/5 border-rose-500/30 hover:border-rose-500/50"
                                  : "bg-[#070c14] border-blue-500/15 hover:border-blue-500/35 hover:bg-[#131f33]/40"
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-mono font-bold text-blue-300 text-[11px]">
                                  {act.orderNumber}
                                </span>
                                {delayed && (
                                  <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/30 uppercase font-mono">
                                    Atraso
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-white leading-snug line-clamp-2">
                                {act.name}
                              </p>
                              <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                <span className={act.progressPercentage === 100 ? "text-emerald-400 font-bold" : "text-orange-400 font-semibold"}>
                                  {act.progressPercentage}%
                                </span>
                                <span className="truncate max-w-[80px] text-slate-400">{act.assignedTo || act.team || "-"}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Painel Lateral de Detalhes da Atividade Selecionada */}
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
      )}

      {/* Modal de Edição de Atividade */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <ActivityForm
              initialActivity={editingActivity}
              onSave={handleSaveEdit}
              onCancel={() => setEditingActivity(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
