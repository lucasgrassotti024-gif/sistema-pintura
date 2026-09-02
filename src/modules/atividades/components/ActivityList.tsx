import React from "react";
import { Activity } from "../types/activity.types";
import { ActivityStatusBadge } from "./ActivityStatusBadge";
import { isActivityDelayed } from "../rules/activity.rules";

interface ActivityListProps {
  activities: Activity[];
  selectedActivity: Activity | null;
  onSelectActivity: (activity: Activity) => void;
  isLoading?: boolean;
}

export function ActivityList({
  activities,
  selectedActivity,
  onSelectActivity,
  isLoading = false,
}: ActivityListProps) {
  if (isLoading) {
    return (
      <div className="bg-[#0c1524] border border-blue-500/15 rounded-lg p-12 text-center text-slate-400 font-mono text-xs shadow-md">
        Carregando frentes de trabalho do Supabase...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-[#0c1524] border border-blue-500/15 rounded-lg p-12 text-center text-slate-400 text-xs shadow-md space-y-1">
        <p className="font-semibold text-white">Nenhuma atividade operacional encontrada.</p>
        <p className="text-[11px] text-slate-500">Verifique os filtros selecionados ou cadastre uma nova ordem de serviço.</p>
      </div>
    );
  }

  return (
    <>
      {/* 1. VISUALIZAÇÃO EM CARDS (MOBILE < 768px) */}
      <div className="md:hidden space-y-3">
        {activities.map((activity) => {
          const delayed = isActivityDelayed(activity);
          const isSelected = selectedActivity?.id === activity.id;

          return (
            <div
              key={activity.id}
              onClick={() => onSelectActivity(activity)}
              className={`p-4 rounded-lg border bg-[#0c1524] shadow-sm transition-all cursor-pointer space-y-2.5 ${
                isSelected
                  ? "border-orange-500/60 bg-orange-500/5 ring-1 ring-orange-500/30"
                  : "border-blue-500/15 hover:border-blue-500/35"
              }`}
            >
              {/* Topo do Card */}
              <div className="flex justify-between items-start gap-2">
                <div className="space-y-0.5">
                  <span className="font-mono font-bold text-xs text-blue-400">
                    {activity.orderNumber}
                  </span>
                  <h3 className="font-semibold text-white text-xs leading-snug">
                    {activity.name}
                  </h3>
                </div>
                <ActivityStatusBadge status={activity.status} />
              </div>

              {/* Localização e Responsável */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1 border-t border-blue-500/10">
                <div>
                  <span className="text-slate-400 font-mono">Área: </span>
                  <span className="font-medium text-slate-200">{activity.location.area || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-mono">Resp: </span>
                  <span className="font-medium text-slate-200">{activity.assignedTo || "-"}</span>
                </div>
              </div>

              {/* Datas e Progresso */}
              <div className="flex justify-between items-center text-[11px] font-mono pt-1">
                <span className="text-slate-400">
                  {activity.schedule.plannedStartDate} → {activity.schedule.plannedEndDate}
                </span>
                <div className="flex items-center gap-2">
                  {delayed && (
                    <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/30 uppercase font-bold">
                      Atraso
                    </span>
                  )}
                  <span className="font-bold text-orange-400">
                    {activity.progressPercentage}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. VISUALIZAÇÃO EM TABELA (DESKTOP >= 768px) */}
      <div className="hidden md:block bg-[#0c1524] border border-blue-500/20 rounded-lg overflow-hidden shadow-md">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-mono font-bold text-slate-400 bg-[#070c14] border-b border-blue-500/15">
            <tr>
              <th className="py-3 px-4">Nota / OS</th>
              <th className="py-3 px-4">Atividade</th>
              <th className="py-3 px-4">Área / Local</th>
              <th className="py-3 px-4">Responsável</th>
              <th className="py-3 px-4">Início</th>
              <th className="py-3 px-4">Término</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Progresso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-500/10">
            {activities.map((activity) => {
              const delayed = isActivityDelayed(activity);
              const isSelected = selectedActivity?.id === activity.id;

              return (
                <tr
                  key={activity.id}
                  onClick={() => onSelectActivity(activity)}
                  className={`hover:bg-blue-500/[0.06] cursor-pointer transition-colors ${
                    isSelected ? "bg-blue-500/15" : ""
                  }`}
                >
                  <td className="py-3 px-4 font-mono font-bold text-blue-400">
                    {activity.orderNumber}
                  </td>
                  <td className="py-3 px-4 font-semibold text-white max-w-[200px] truncate">
                    {activity.name}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {activity.location.area || "-"}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {activity.assignedTo || "-"}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {activity.schedule.plannedStartDate}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    <span className={delayed ? "text-rose-400 font-semibold" : ""}>
                      {activity.schedule.plannedEndDate}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <ActivityStatusBadge status={activity.status} />
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-orange-400">
                    {activity.progressPercentage}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
