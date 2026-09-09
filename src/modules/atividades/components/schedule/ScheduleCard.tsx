import React from "react";
import { Activity } from "../../types/activity.types";
import { isActivityDelayed } from "../../rules/activity.rules";
import { formatDateISO } from "../../utils/week.utils";
import { calculateDaysDifference } from "../../utils/schedule.utils";

interface ScheduleCardProps {
  activity: Activity;
  isSelected?: boolean;
  isEditMode?: boolean;
  isPending?: boolean;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  onClick?: () => void;
  onOpenMobileReschedule?: (act: Activity) => void;
}

export function ScheduleCard({
  activity,
  isSelected = false,
  isEditMode = false,
  isPending = false,
  effectiveStartDate,
  effectiveEndDate,
  onClick,
  onOpenMobileReschedule,
}: ScheduleCardProps) {
  const todayISO = formatDateISO(new Date());
  const delayed = isActivityDelayed(activity, todayISO);

  const start = effectiveStartDate || activity.schedule.plannedStartDate;
  const end = effectiveEndDate || activity.schedule.plannedEndDate;
  const diff = calculateDaysDifference(start, end);
  const isMultiDay = diff > 0;

  // Status badge style helper
  const getStatusColor = () => {
    switch (activity.status) {
      case "em_andamento":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      case "concluida":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "cancelada":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      case "pausada":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      default:
        return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    }
  };

  const getStatusLabel = () => {
    switch (activity.status) {
      case "em_andamento":
        return "Em Andamento";
      case "concluida":
        return "Concluída";
      case "cancelada":
        return "Cancelada";
      case "pausada":
        return "Pausada";
      default:
        return "Programada";
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!isEditMode) return;
    e.dataTransfer.setData("text/plain", activity.id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable={isEditMode}
      onDragStart={handleDragStart}
      onClick={onClick}
      className={`p-3 rounded-lg border text-xs transition-all select-none relative group ${
        isEditMode
          ? "cursor-grab active:cursor-grabbing hover:shadow-md"
          : "cursor-pointer"
      } ${
        isPending
          ? "bg-orange-500/10 border-orange-500/50 ring-1 ring-orange-500/40"
          : isSelected
          ? "bg-blue-600/20 border-blue-500 ring-1 ring-blue-500"
          : delayed
          ? "bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50"
          : "bg-[#070c14] border-blue-500/15 hover:border-blue-500/35 hover:bg-[#0c1524]"
      }`}
    >
      {/* Topo do Card: OS + Tag de Pendente / Atraso */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="font-mono font-bold text-blue-300 text-[11px] tracking-wide">
          {activity.orderNumber}
        </span>

        <div className="flex items-center gap-1">
          {isPending && (
            <span className="text-[9px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded font-mono shadow-xs animate-pulse">
              Pendente
            </span>
          )}
          {delayed && !isPending && (
            <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30 uppercase font-mono">
              Atraso
            </span>
          )}
          {isMultiDay && (
            <span className="text-[9px] font-mono text-slate-400 bg-slate-800/80 px-1 rounded border border-slate-700/60" title={`Duração total: ${diff + 1} dias`}>
              {diff + 1}d
            </span>
          )}
        </div>
      </div>

      {/* Nome / Descrição principal */}
      <p className="font-medium text-white leading-snug line-clamp-2 mb-2">
        {activity.name}
      </p>

      {/* Detalhes operacionais essenciais */}
      <div className="space-y-1 text-[10px] text-slate-400 font-mono">
        <div className="flex items-center justify-between">
          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold uppercase ${getStatusColor()}`}>
            {getStatusLabel()}
          </span>
          <span className={activity.progressPercentage === 100 ? "text-emerald-400 font-bold" : "text-slate-300"}>
            {activity.progressPercentage}%
          </span>
        </div>

        {/* Responsável e Área */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/60 text-[10px]">
          <span className="truncate max-w-[120px] text-slate-300 flex items-center gap-1" title={activity.assignedTo || "Sem responsável"}>
            👤 {activity.assignedTo || activity.team || "-"}
          </span>
          <span className="truncate max-w-[80px] text-slate-400" title={activity.location?.area || "Sem área"}>
            📍 {activity.location?.area || "-"}
          </span>
        </div>
      </div>

      {/* Ação Mobile/Acessível de Reprogramação (visível no modo de edição) */}
      {isEditMode && onOpenMobileReschedule && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMobileReschedule(activity);
          }}
          title="Mudar data desta atividade"
          className="mt-2.5 w-full py-1 px-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <span>📅</span>
          <span>Alterar data</span>
        </button>
      )}
    </div>
  );
}
