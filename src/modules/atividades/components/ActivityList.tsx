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
      <div className="p-8 sm:p-12 text-center text-slate-400 border border-blue-500/15 rounded-lg bg-[#0c1524]/70 backdrop-blur-xs">
        <div className="w-10 h-10 rounded-full bg-blue-500/10 mx-auto mb-3 flex items-center justify-center text-blue-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="font-semibold text-white text-sm">Nenhuma atividade encontrada</p>
        <p className="text-xs text-slate-400 mt-1">Ajuste os filtros de busca para visualizar os registros operacionais.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 1. VISUALIZAÇÃO EM CARDS (MOBILE < 768px) */}
      <div className="md:hidden space-y-3">
        {activities.map((activity) => {
          const delayed = isActivityDelayed(activity);
          const mainTag = activity.tags[0]?.code || "-";
          const extraTagsCount = activity.tags.length - 1;

          return (
            <div
              key={activity.id}
              onClick={() => onSelectActivity?.(activity)}
              className={`p-4 rounded-lg border bg-[#0c1524] shadow-sm active:bg-blue-500/10 transition-all cursor-pointer space-y-3 ${
                delayed
                  ? "border-rose-500/40 bg-rose-500/[0.04]"
                  : "border-blue-500/15 hover:border-blue-500/35"
              }`}
            >
              {/* Topo do Card: OS, Status e Prioridade */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2">
                  {delayed && (
                    <span
                      title="Atividade em Atraso"
                      className="inline-block w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] shrink-0"
                    />
                  )}
                  <span className="font-mono font-bold text-blue-400 text-xs">
                    {activity.orderNumber}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <ActivityPriorityBadge priority={activity.priority} />
                  <ActivityStatusBadge status={activity.status} />
                </div>
              </div>

              {/* Título e Descrição */}
              <div>
                <h3 className="text-sm font-semibold text-white leading-snug">
                  {activity.name}
                </h3>
                {activity.description && activity.description !== activity.name && (
                  <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                    {activity.description}
                  </p>
                )}
              </div>

              {/* Metadados: Área, Tag, Responsável */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-1 border-t border-blue-500/10">
                <span className="bg-[#070c14] px-2 py-0.5 rounded border border-blue-500/15 text-[11px] text-slate-300 font-medium">
                  {activity.location.area}
                </span>
                <span className="bg-[#070c14] px-2 py-0.5 rounded border border-blue-500/15 font-mono text-[11px] text-blue-400">
                  {mainTag} {extraTagsCount > 0 ? `+${extraTagsCount}` : ""}
                </span>
                <span className="text-slate-400 text-[11px] ml-auto truncate max-w-[140px]">
                  Resp: {activity.assignedTo || "—"}
                </span>
              </div>

              {/* Datas e Barra de Progresso */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">
                    {activity.schedule.plannedStartDate} → <span className={delayed ? "text-rose-400 font-bold" : "text-slate-300"}>{activity.schedule.plannedEndDate}</span>
                  </span>
                  <span className="text-orange-400 font-bold">
                    {activity.progressPercentage}%
                  </span>
                </div>
                <div className="w-full bg-[#070c14] rounded-full h-1.5 overflow-hidden border border-blue-500/15">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      activity.progressPercentage >= 100
                        ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                        : "bg-orange-500"
                    }`}
                    style={{ width: `${Math.min(activity.progressPercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. VISUALIZAÇÃO EM TABELA TÉCNICA (DESKTOP/TABLET >= 768px) */}
      <div className="hidden md:block overflow-x-auto border border-blue-500/15 rounded-lg bg-[#0c1524] shadow-sm">
        <table className="min-w-full divide-y divide-blue-500/10 text-left text-xs">
          <thead className="bg-[#070c14]/90 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
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
          <tbody className="divide-y divide-blue-500/10 bg-transparent">
            {activities.map((activity) => {
              const delayed = isActivityDelayed(activity);
              const mainTag = activity.tags[0]?.code || "-";
              const extraTagsCount = activity.tags.length - 1;

              return (
                <tr
                  key={activity.id}
                  onClick={() => onSelectActivity?.(activity)}
                  className={`hover:bg-blue-500/[0.06] cursor-pointer transition-colors duration-150 group ${
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
                      <span className="text-white font-semibold group-hover:text-orange-400 transition-colors">
                        {activity.orderNumber}
                      </span>
                    </div>
                  </td>

                  {/* Nome / Descrição */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="font-semibold text-white leading-snug">{activity.name}</p>
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
                      <span className="font-mono text-[11px] bg-[#070c14] text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">
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
                        <span className="text-orange-400 font-bold">{activity.progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-[#070c14] rounded-full h-1.5 overflow-hidden border border-blue-500/15">
                        <div
                          className={`h-full rounded-full ${
                            activity.progressPercentage >= 100
                              ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                              : "bg-orange-500"
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
    </div>
  );
}
