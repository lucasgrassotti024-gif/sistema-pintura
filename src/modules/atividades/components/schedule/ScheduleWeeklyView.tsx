import React, { useState } from "react";
import { Activity } from "../../types/activity.types";
import { WeekInfo } from "../../utils/week.utils";
import { ScheduleCard } from "./ScheduleCard";
import { getActivitiesForDayWithPending } from "../../utils/schedule.utils";

interface ScheduleWeeklyViewProps {
  weekInfo: WeekInfo;
  activities: Activity[];
  selectedActivity: Activity | null;
  isEditMode: boolean;
  pendingChanges: Map<string, { newStartDate: string; newEndDate: string; durationDays: number }>;
  onSelectActivity: (act: Activity) => void;
  onDropActivityOnDay: (activityId: string, targetDayStr: string) => void;
  onOpenMobileReschedule: (act: Activity) => void;
}

export function ScheduleWeeklyView({
  weekInfo,
  activities,
  selectedActivity,
  isEditMode,
  pendingChanges,
  onSelectActivity,
  onDropActivityOnDay,
  onOpenMobileReschedule,
}: ScheduleWeeklyViewProps) {
  const [activeDragOverDay, setActiveDragOverDay] = useState<string | null>(null);

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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {weekInfo.days.map((day) => {
        const dayActivities = getActivitiesForDayWithPending(activities, day.date, pendingChanges);
        const isDragTarget = activeDragOverDay === day.date;

        return (
          <div
            key={day.date}
            onDragOver={(e) => handleDragOver(e, day.date)}
            onDragLeave={(e) => handleDragLeave(e, day.date)}
            onDrop={(e) => handleDrop(e, day.date)}
            className={`bg-[#0c1524] border rounded-xl p-3 flex flex-col min-h-[160px] md:min-h-[480px] transition-all duration-150 shadow-sm ${
              isDragTarget
                ? "border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/50 scale-[1.01]"
                : day.isToday
                ? "border-orange-500/60 ring-1 ring-orange-500/30"
                : "border-blue-500/15 hover:border-blue-500/30"
            }`}
          >
            {/* Cabeçalho do Dia */}
            <div className="border-b border-blue-500/15 pb-2.5 mb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      day.isToday ? "text-orange-400 font-mono" : "text-slate-200"
                    }`}
                  >
                    {day.dayOfWeek}
                  </span>
                  {day.isToday && (
                    <span className="text-[9px] uppercase font-bold bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/40 font-mono">
                      Hoje
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {day.label}
                </span>
              </div>

              {/* Contador de Atividades no Dia */}
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  dayActivities.length > 0
                    ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                    : "bg-slate-800/40 text-slate-500 border-slate-700/30"
                }`}
              >
                {dayActivities.length}
              </span>
            </div>

            {/* Drop Zone Feedback no Modo de Edição */}
            {isEditMode && isDragTarget && (
              <div className="mb-2 p-2 border-2 border-dashed border-orange-500/70 rounded-lg text-center text-xs font-mono text-orange-300 bg-orange-500/15 animate-pulse">
                Soltar atividade aqui
              </div>
            )}

            {/* Lista de Atividades do Dia */}
            <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5 custom-scrollbar">
              {dayActivities.length === 0 ? (
                <div className="h-full flex items-center justify-center py-8">
                  <p className="text-[11px] text-slate-500 text-center font-mono">
                    {isEditMode ? "Arraste uma OS para cá" : "Sem atividades"}
                  </p>
                </div>
              ) : (
                dayActivities.map((act) => {
                  const pending = pendingChanges.get(act.id);
                  const isSelected = selectedActivity?.id === act.id;

                  return (
                    <ScheduleCard
                      key={`${act.id}-${day.date}`}
                      activity={act}
                      isSelected={isSelected}
                      isEditMode={isEditMode}
                      isPending={Boolean(pending)}
                      effectiveStartDate={pending?.newStartDate}
                      effectiveEndDate={pending?.newEndDate}
                      onClick={() => onSelectActivity(act)}
                      onOpenMobileReschedule={onOpenMobileReschedule}
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
