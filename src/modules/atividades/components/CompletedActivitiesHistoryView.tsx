"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { getHistoryActivities, deleteActivityPermanently } from "@/modules/atividades/services/activity.service";
import { ActivityStatusBadge } from "@/modules/atividades/components/ActivityStatusBadge";
import { ActivityDetails } from "@/modules/atividades/components/ActivityDetails";
import { Activity } from "@/modules/atividades/types/activity.types";
import { createClient } from "@/lib/supabase/client";

export function CompletedActivitiesHistoryView() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [activeTab, setActiveTab] = useState<"concluidas" | "canceladas" | "arquivadas">("concluidas");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getHistoryActivities();
      setActivities(data);
      if (selectedActivity) {
        const refreshed = data.find((a) => a.id === selectedActivity.id);
        if (refreshed) setSelectedActivity(refreshed);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar histórico do banco.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedActivity]);

  useEffect(() => {
    loadData();
  }, []);

  // Sincronização em Tempo Real do Histórico (Supabase Realtime)
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("realtime-history-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activities",
        },
        async () => {
          try {
            const data = await getHistoryActivities();
            setActivities(data);
          } catch (err) {
            console.warn("Aviso ao sincronizar histórico via Realtime:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Estados de Busca e Filtros
  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState("todas");
  const [selectedResp, setSelectedResp] = useState("todos");

  // Base por aba
  const baseActivities = useMemo(() => {
    if (activeTab === "arquivadas") {
      return activities.filter((act) => !!act.archivedAt);
    }
    if (activeTab === "concluidas") {
      return activities.filter(
        (act) => !act.archivedAt && (act.status === "concluida" || act.progressPercentage === 100)
      );
    }
    return activities.filter((act) => !act.archivedAt && act.status === "cancelada");
  }, [activities, activeTab]);

  const countConcluidas = useMemo(
    () => activities.filter((a) => !a.archivedAt && (a.status === "concluida" || a.progressPercentage === 100)).length,
    [activities]
  );
  const countCanceladas = useMemo(
    () => activities.filter((a) => !a.archivedAt && a.status === "cancelada").length,
    [activities]
  );
  const countArquivadas = useMemo(
    () => activities.filter((a) => !!a.archivedAt).length,
    [activities]
  );

  // Listas de opções para filtros
  const areasList = useMemo(() => {
    const set = new Set<string>();
    baseActivities.forEach((a) => {
      if (a.location?.area) set.add(a.location.area);
    });
    return Array.from(set);
  }, [baseActivities]);

  const respList = useMemo(() => {
    const set = new Set<string>();
    baseActivities.forEach((a) => {
      if (a.assignedTo) set.add(a.assignedTo);
    });
    return Array.from(set);
  }, [baseActivities]);

  // Filtragem
  const filteredActivities = useMemo(() => {
    return baseActivities.filter((act) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesOrder = act.orderNumber?.toLowerCase().includes(q);
        const matchesName = act.name?.toLowerCase().includes(q);
        const matchesResp = act.assignedTo?.toLowerCase().includes(q);
        const matchesArea = act.location?.area?.toLowerCase().includes(q);
        if (!matchesOrder && !matchesName && !matchesResp && !matchesArea) return false;
      }
      if (selectedArea !== "todas" && act.location?.area !== selectedArea) {
        return false;
      }
      if (selectedResp !== "todos" && act.assignedTo !== selectedResp) {
        return false;
      }
      return true;
    });
  }, [baseActivities, search, selectedArea, selectedResp]);

  const handleDeletePermanently = async (activityId: string) => {
    await deleteActivityPermanently(activityId);
    setActivities((prev) => prev.filter((a) => a.id !== activityId));
    setSelectedActivity(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Cabeçalho do Histórico */}
      <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Histórico Operacional de Atividades
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
              Registros Consolidados RSS3
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Consulta e auditoria de atividades concluídas, canceladas e arquivadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/pintura/atividades"
            className="text-xs font-semibold px-3 py-1.5 bg-[#070c14] hover:bg-blue-500/15 text-slate-300 rounded border border-blue-500/20 transition-colors"
          >
            ← Frentes Ativas
          </Link>
          <button
            type="button"
            onClick={loadData}
            title="Recarregar histórico"
            className="p-1.5 bg-[#070c14] hover:bg-blue-500/15 text-slate-400 hover:text-white rounded border border-blue-500/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Diagnóstico de Erro Real (se houver) */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* Grid Principal: Tabela + Painel Lateral de Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selectedActivity ? "lg:col-span-2 space-y-4" : "lg:col-span-3 space-y-4"}>
          {/* Navegação por Abas */}
          <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-2 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-1.5 bg-[#070c14] p-1 rounded border border-blue-500/20 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("concluidas");
                  setSelectedActivity(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  activeTab === "concluidas"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Concluídas ({countConcluidas})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("canceladas");
                  setSelectedActivity(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  activeTab === "canceladas"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Canceladas ({countCanceladas})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("arquivadas");
                  setSelectedActivity(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  activeTab === "arquivadas"
                    ? "bg-slate-700 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Arquivadas ({countArquivadas})
              </button>
            </div>
          </div>

          {/* Filtros de Busca */}
          <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs shadow-md">
            <div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar OS, atividade, responsável..."
                className="w-full bg-[#070c14] border border-blue-500/20 rounded px-2.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-orange-500"
              />
            </div>
            <div>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full bg-[#070c14] border border-blue-500/20 rounded px-2.5 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
              >
                <option value="todas">Todas as Áreas</option>
                {areasList.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedResp}
                onChange={(e) => setSelectedResp(e.target.value)}
                className="w-full bg-[#070c14] border border-blue-500/20 rounded px-2.5 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
              >
                <option value="todos">Todos os Responsáveis</option>
                {respList.map((resp) => (
                  <option key={resp} value={resp}>
                    {resp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 1. VISUALIZAÇÃO EM CARDS (MOBILE < 768px) */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 font-mono text-xs bg-[#0c1524] rounded-lg border border-blue-500/15">
                Carregando histórico do Supabase...
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-mono text-xs bg-[#0c1524] rounded-lg border border-blue-500/15">
                Nenhuma atividade encontrada nesta aba.
              </div>
            ) : (
              filteredActivities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => setSelectedActivity(act)}
                  className={`p-3.5 rounded-lg border bg-[#0c1524] shadow-sm transition-all cursor-pointer space-y-2 ${
                    selectedActivity?.id === act.id
                      ? "border-orange-500/60 bg-orange-500/5 ring-1 ring-orange-500/30"
                      : "border-blue-500/15 hover:border-blue-500/35"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-blue-400 text-xs">{act.orderNumber}</span>
                    <ActivityStatusBadge status={act.status} />
                  </div>
                  <p className="font-semibold text-white text-xs leading-snug">{act.name}</p>
                  <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-blue-500/10">
                    <span>{act.location?.area || "—"}</span>
                    <span>Resp: {act.assignedTo || "—"}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 2. VISUALIZAÇÃO EM TABELA TÉCNICA (DESKTOP >= 768px) */}
          <div className="hidden md:block bg-[#0c1524] border border-blue-500/20 rounded-lg overflow-hidden shadow-md">
            <table className="min-w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-mono font-bold text-slate-400 bg-[#070c14] border-b border-blue-500/15">
                <tr>
                  <th className="py-2.5 px-3">OS</th>
                  <th className="py-2.5 px-3">Atividade</th>
                  <th className="py-2.5 px-3">Área / Local</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/10">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-mono">
                      Carregando histórico do Supabase...
                    </td>
                  </tr>
                ) : filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-mono">
                      Nenhuma atividade encontrada nesta aba.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((act) => (
                    <tr
                      key={act.id}
                      onClick={() => setSelectedActivity(act)}
                      className={`hover:bg-blue-500/[0.06] cursor-pointer transition-colors ${
                        selectedActivity?.id === act.id ? "bg-blue-500/15" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-400">
                        {act.orderNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white max-w-[200px] truncate">
                        {act.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {act.location?.area || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {act.assignedTo || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <ActivityStatusBadge status={act.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Painel Lateral de Detalhes da Atividade Selecionada */}
        {selectedActivity && (
          <div className="lg:col-span-1">
            <ActivityDetails
              activity={selectedActivity}
              allowPermanentDelete={true}
              onDeletePermanently={handleDeletePermanently}
              onClose={() => setSelectedActivity(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
