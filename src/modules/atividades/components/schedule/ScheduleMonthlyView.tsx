import React, { useState } from "react";
import { Activity } from "../../types/activity.types";
import { MonthInfo, getActivitiesForDayWithPending } from "../../utils/schedule.utils";
import { isActivityDelayed } from "../../rules/activity.rules";
import { formatDateISO } from "../../utils/week.utils";
import { ScheduleCard } from "./ScheduleCard";

interface ScheduleMonthlyViewProps {
  monthInfo: MonthInfo;
  activities: Activity[];
  selectedActivity: Activity | null;
  isEditMode: boolean;
  pendingChanges: Map<string, { newStartDate: string; newEndDate: string; durationDays: number }>;
  onSelectActivity: (act: Activity) => void;
  onDropActivityOnDay: (activityId: string, targetDayStr: string) => void;
  onOpenMobileReschedule: (act: Activity) => void;
}

export function ScheduleMonthlyView({
  monthInfo,
  activities,
  selectedActivity,
  isEditMode,
  pendingChanges,
  onSelectActivity,
  onDropActivityOnDay,
  onOpenMobileReschedule,
}: ScheduleMonthlyViewProps) {
  const [activeDragOverDay, setActiveDragOverDay] = useState<string | null>(null);
  const [activeDrawerDay, setActiveDrawerDay] = useState<string | null>(null);

  const todayISO = formatDateISO(new Date());

  const handleDragOver = (e: React.DragEvent, dayDate: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (activeDragOverDay !== dayDate) {
      setActiveDragOverDay(dayDate);
    }
  };

  const handleDragLeave = (e: React.DragEvent, dayDate: string) => {
    if (activeDragOverDay === dayDate) {
      setActiveDragOverDay(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dayDate: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    setActiveDragOverDay(null);
    const activityId = e.dataTransfer.getData("text/plain");
    if (activityId) {
      onDropActivityOnDay(activityId, dayDate);
    }
  };

  // Atividades do dia selecionado para o Drawer
  const drawerActivities = activeDrawerDay
    ? getActivitiesForDayWithPending(activities, activeDrawerDay, pendingChanges)
    : [];

  return (
    <div className="space-y-4">
      {/* Grade de 7 Colunas (Segunda a Domingo) */}
      <div className="bg-[#0c1524] border border-blue-500/15 rounded-xl overflow-hidden shadow-sm">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 border-b border-blue-500/15 bg-[#070c14] text-center">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d, idx) => (
            <div
              key={d}
              className={`py-2.5 text-xs font-mono font-bold uppercase tracking-wider ${
                idx >= 5 ? "text-slate-500" : "text-slate-300"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grade de Células dos Dias */}
        <div className="grid grid-cols-7 divide-x divide-y divide-blue-500/10">
          {monthInfo.days.map((day) => {
            const dayActivities = getActivitiesForDayWithPending(activities, day.date, pendingChanges);
            const isDragTarget = activeDragOverDay === day.date;
            const hasDelayed = dayActivities.some((a) => isActivityDelayed(a, todayISO));

            return (
              <div
                key={day.date}
                onDragOver={(e) => handleDragOver(e, day.date)}
                onDragLeave={(e) => handleDragLeave(e, day.date)}
                onDrop={(e) => handleDrop(e, day.date)}
                onClick={() => {
                  if (dayActivities.length > 0) {
                    setActiveDrawerDay(day.date);
                  }
                }}
                className={`min-h-[90px] sm:min-h-[110px] p-2 flex flex-col justify-between transition-colors ${
                  isDragTarget
                    ? "bg-orange-500/15 ring-2 ring-orange-500/60"
                    : !day.isCurrentMonth
                    ? "bg-[#060a12]/60 opacity-45"
                    : day.isToday
                    ? "bg-orange-500/5 ring-1 ring-orange-500/30"
                    : "bg-[#0c1524] hover:bg-[#0f1b2e]/60"
                } ${dayActivities.length > 0 ? "cursor-pointer" : ""}`}
              >
                {/* Topo da Célula: Número do Dia + Indicador de Atraso */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono font-bold ${
                      day.isToday
                        ? "text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-500/40"
                        : day.isCurrentMonth
                        ? "text-slate-200"
                        : "text-slate-600"
                    }`}
                  >
                    {day.dayNumber}
                  </span>

                  <div className="flex items-center gap-1">
                    {hasDelayed && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" title="Há atividades atrasadas neste dia" />
                    )}
                    {dayActivities.length > 0 && (
                      <span className="text-[10px] font-mono font-semibold px-1.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        {dayActivities.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Prévia compacta das Atividades (até 2 badges visíveis) */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {dayActivities.slice(0, 2).map((act) => {
                    const isPending = pendingChanges.has(act.id);
                    return (
                      <div
                        key={`${act.id}-${day.date}`}
                        draggable={isEditMode}
                        onDragStart={(e) => {
                          if (!isEditMode) return;
                          e.stopPropagation();
                          e.dataTransfer.setData("text/plain", act.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectActivity(act);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate font-mono border transition-all ${
                          isPending
                            ? "bg-orange-500 text-white border-orange-400 font-bold"
                            : act.status === "em_andamento"
                            ? "bg-blue-600/30 text-blue-200 border-blue-500/40"
                            : act.status === "concluida"
                            ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/30"
                            : "bg-slate-800 text-slate-300 border-slate-700/50"
                        }`}
                        title={`${act.orderNumber} - ${act.name}`}
                      >
                        {act.orderNumber} {act.name}
                      </div>
                    );
                  })}

                  {dayActivities.length > 2 && (
                    <div className="text-[9px] font-mono text-slate-400 text-center">
                      +{dayActivities.length - 2} mais
                    </div>
                  )}
                </div>

                <div />
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawer / Painel Lateral Modal com as Atividades do Dia Selecionado */}
      {activeDrawerDay && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0c1524] border border-blue-500/20 rounded-xl p-5 max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-blue-500/15">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-orange-400">
                  Frentes Operacionais
                </span>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Programação de {activeDrawerDay}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawerDay(null)}
                className="text-slate-400 hover:text-white text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
              {drawerActivities.map((act) => {
                const pending = pendingChanges.get(act.id);
                const isSelected = selectedActivity?.id === act.id;

                return (
                  <ScheduleCard
                    key={`drawer-${act.id}`}
                    activity={act}
                    isSelected={isSelected}
                    isEditMode={isEditMode}
                    isPending={Boolean(pending)}
                    effectiveStartDate={pending?.newStartDate}
                    effectiveEndDate={pending?.newEndDate}
                    onClick={() => {
                      onSelectActivity(act);
                      setActiveDrawerDay(null);
                    }}
                    onOpenMobileReschedule={(targetAct) => {
                      setActiveDrawerDay(null);
                      onOpenMobileReschedule(targetAct);
                    }}
                  />
                );
              })}
            </div>

            <div className="pt-2 border-t border-blue-500/15 text-right">
              <button
                type="button"
                onClick={() => setActiveDrawerDay(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
