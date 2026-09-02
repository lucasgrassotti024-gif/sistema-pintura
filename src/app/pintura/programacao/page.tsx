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
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Programação Operacional
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quadro semanal de ordens de serviço, frentes ativas e distribuição de equipes RSS3.
          </p>
        </div>

        {/* Navegação Semanal */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white border border-slate-200 rounded-md overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={handlePreviousWeek}
              title="Semana anterior"
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 border-r border-slate-200 transition-colors"
            >
              ←
            </button>
            <button
              type="button"
              onClick={handleCurrentWeek}
              title="Ir para semana atual"
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              title="Próxima semana"
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 border-l border-slate-200 transition-colors"
            >
              →
            </button>
          </div>

          <span className="text-xs font-mono font-bold px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-md">
            {weekInfo.label}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 font-mono">
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
                    className={`bg-white border rounded-lg p-3.5 flex flex-col min-h-[120px] md:min-h-[380px] transition-all shadow-xs ${
                      day.isToday
                        ? "border-blue-400 bg-blue-50/20 shadow-xs ring-1 ring-blue-400"
                        : "border-slate-200"
                    }`}
                  >
                    {/* Cabeçalho do Dia */}
                    <div className="border-b border-slate-100 pb-2 mb-3">
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-bold ${day.isToday ? "text-blue-700 font-mono" : "text-slate-900"}`}>
                          {day.dayOfWeek}
                        </span>
                        {day.isToday && (
                          <span className="text-[9px] uppercase font-bold bg-blue-600 text-white px-1.5 py-0.2 rounded font-mono">
                            Hoje
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">{day.label}</span>
                    </div>

                    {/* Lista de Atividades do Dia */}
                    <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                      {dayActivities.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-10 font-mono">Sem atividades</p>
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
                                  ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500"
                                  : delayed
                                  ? "bg-rose-50/50 border-rose-200 hover:border-rose-300"
                                  : "bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-white"
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-mono font-bold text-blue-700 text-[11px]">
                                  {act.orderNumber}
                                </span>
                                {delayed && (
                                  <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded border border-rose-200 uppercase font-mono">
                                    Atraso
                                  </span>
                                )}
                              </div>
                              <p className="font-semibold text-slate-900 leading-snug line-clamp-2">
                                {act.name}
                              </p>
                              <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                <span className={act.progressPercentage === 100 ? "text-emerald-700 font-bold" : "text-blue-700 font-semibold"}>
                                  {act.progressPercentage}%
                                </span>
                                <span className="truncate max-w-[80px] text-slate-600">{act.assignedTo || act.team || "-"}</span>
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
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
