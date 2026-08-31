import React from "react";
import { Activity } from "../types/activity.types";
import { ActivityStatusBadge } from "./ActivityStatusBadge";
import { ActivityPriorityBadge } from "./ActivityPriorityBadge";
import { isActivityDelayed } from "../rules/activity.rules";

interface ActivityListProps {
  activities?: Activity[];
  onSelectActivity?: (activity: Activity) => void;
}

export function ActivityList({ activities = [], onSelectActivity }: ActivityListProps) {
  if (activities.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400 border border-white/5 rounded-lg bg-[#0f172a]/40 backdrop-blur-xs">
        <div className="w-10 h-10 rounded-full bg-white/5 mx-auto mb-3 flex items-center justify-center text-slate-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="font-semibold text-slate-200 text-sm">Nenhuma atividade encontrada</p>
        <p className="text-xs text-slate-500 mt-1">Ajuste os filtros de busca para visualizar os registros operacionais.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-white/5 rounded-lg bg-[#0f172a] shadow-sm">
      <table className="min-w-full divide-y divide-white/5 text-left text-xs">
        <thead className="bg-[#090d16]/70 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
          <tr>
            <th className="py-3 px-4">Nota / OS</th>
            <th className="py-3 px-4">Atividade / Descrição</th>
            <th className="py-3 px-4">Área</th>
            <th className="py-3 px-4">Tag</th>
            <th className="py-3 px-4">Período Planejado</th>
            <th className="py-3 px-4">Progresso</th>
            <th className="py-3 px-4">Prioridade</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Responsável</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 bg-transparent">
          {activities.map((activity) => {
            const delayed = isActivityDelayed(activity);
            const mainTag = activity.tags[0]?.code || "-";
            const extraTagsCount = activity.tags.length - 1;

            return (
              <tr
                key={activity.id}
                onClick={() => onSelectActivity?.(activity)}
                className={`hover:bg-white/[0.03] cursor-pointer transition-colors duration-150 group ${
                  delayed ? "bg-rose-500/[0.04]" : ""
                }`}
              >
                {/* Nota */}
                <td className="py-3.5 px-4 font-mono font-medium text-slate-200 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {delayed && (
                      <span
                        title="Atividade em Atraso"
                        className="inline-block w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] shrink-0"
                      />
                    )}
                    <span className="text-slate-100 font-semibold group-hover:text-emerald-400 transition-colors">
                      {activity.orderNumber}
                    </span>
                  </div>
                </td>

                {/* Nome / Descrição */}
                <td className="py-3.5 px-4 max-w-xs">
                  <p className="font-semibold text-slate-100 leading-snug">{activity.name}</p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5" title={activity.description}>
                    {activity.description}
                  </p>
                </td>

                {/* Área */}
                <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                  {activity.location.area}
                </td>

                {/* Tag Principal */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-white/5">
                      {mainTag}
                    </span>
                    {extraTagsCount > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono" title={`${activity.tags.map(t => t.code).join(", ")}`}>
                        +{extraTagsCount}
                      </span>
                    )}
                  </div>
                </td>

                {/* Data Planejada */}
                <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                  <span className="text-slate-300">
                    {activity.schedule.plannedStartDate}
                  </span>
                  <span className="text-slate-400 mx-1">→</span>
                  <span
                    className={`${
                      delayed ? "text-rose-400 font-bold" : "text-slate-300"
                    }`}
                  >
                    {activity.schedule.plannedEndDate}
                  </span>
                </td>

                {/* Progresso */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="w-24">
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                      <span>{activity.progressPercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          activity.progressPercentage >= 100
                            ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                            : "bg-emerald-400/80"
                        }`}
                        style={{ width: `${Math.min(activity.progressPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>

                {/* Prioridade */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <ActivityPriorityBadge priority={activity.priority} />
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <ActivityStatusBadge status={activity.status} />
                </td>

                {/* Responsável */}
                <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                  {activity.assignedTo || "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
