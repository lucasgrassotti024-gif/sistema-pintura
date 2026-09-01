"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useActivities } from "@/modules/atividades/hooks/useActivities";
import { useMaterials } from "@/modules/materiais/hooks/useMaterials";
import { isActivityDelayed } from "@/modules/atividades/rules/activity.rules";
import { ActivityStatusBadge } from "@/modules/atividades/components/ActivityStatusBadge";
import { ActivityDetails } from "@/modules/atividades/components/ActivityDetails";
import { Activity } from "@/modules/atividades/types/activity.types";
import { formatDateISO, getWeekInfo } from "@/modules/atividades/utils/week.utils";

export function DashboardView() {
  const {
    activities,
    isLoading: loadingActivities,
    error: errorActivities,
    updateActivity,
    archiveActivity,
  } = useActivities();

  const {
    rawMaterials,
    isLoading: loadingMaterials,
    error: errorMaterials,
  } = useMaterials();

  const [period, setPeriod] = useState<"hoje" | "semana" | "mes" | "todas">("semana");
  const [selectedArea, setSelectedArea] = useState("todas");
  const [selectedTeam, setSelectedTeam] = useState("todas");
  const [selectedResp, setSelectedResp] = useState("todos");
  const [statusCardFilter, setStatusCardFilter] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Data atual real
  const todayISO = useMemo(() => formatDateISO(new Date()), []);
  const tomorrowISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateISO(d);
  }, []);
  const currentWeek = useMemo(() => getWeekInfo(new Date(), true), []);

  // Lista dinâmica de Áreas reais extraídas das atividades
  const areasList = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => {
      if (a.location?.area) set.add(a.location.area);
    });
    return Array.from(set).sort();
  }, [activities]);

  // Lista dinâmica de Equipes reais
  const teamsList = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => {
      if (a.team) set.add(a.team);
    });
    return Array.from(set).sort();
  }, [activities]);

  // Lista dinâmica de Responsáveis reais
  const respList = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => {
      if (a.assignedTo) set.add(a.assignedTo);
    });
    return Array.from(set).sort();
  }, [activities]);

  // Filtragem de atividades com base no período e filtros selecionados
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Filtro de Período real
      if (period === "hoje") {
        const isToday =
          act.schedule.plannedStartDate === todayISO ||
          (act.status === "em_andamento" &&
            act.schedule.plannedStartDate <= todayISO &&
            act.schedule.plannedEndDate >= todayISO);
        if (!isToday) return false;
      } else if (period === "semana") {
        // Interseção com a semana atual (ISO)
        const overlap =
          act.schedule.plannedStartDate <= currentWeek.endDate &&
          act.schedule.plannedEndDate >= currentWeek.startDate;
        if (!overlap) return false;
      } else if (period === "mes") {
        const currentMonth = todayISO.substring(0, 7);
        const startMonth = act.schedule.plannedStartDate.substring(0, 7);
        const endMonth = act.schedule.plannedEndDate.substring(0, 7);
        const overlapMonth = startMonth <= currentMonth && endMonth >= currentMonth;
        if (!overlapMonth) return false;
      }

      // Filtro por Área
      if (selectedArea !== "todas" && act.location?.area !== selectedArea) {
        return false;
      }

      // Filtro por Equipe
      if (selectedTeam !== "todas" && act.team !== selectedTeam) {
        return false;
      }

      // Filtro por Responsável
      if (selectedResp !== "todos" && act.assignedTo !== selectedResp) {
        return false;
      }

      // Filtro por Card clicado (se ativo)
      if (statusCardFilter) {
        if (statusCardFilter === "atrasadas") {
          if (!isActivityDelayed(act, todayISO)) return false;
        } else if (statusCardFilter === "programadas") {
          if (act.status !== "programada" && act.status !== "planejada") return false;
        } else if (statusCardFilter === "em_andamento") {
          if (act.status !== "em_andamento") return false;
        } else if (statusCardFilter === "concluidas") {
          if (act.status !== "concluida") return false;
        }
      }

      return true;
    });
  }, [activities, period, todayISO, currentWeek, selectedArea, selectedTeam, selectedResp, statusCardFilter]);

  // Indicadores Numéricos Consolidados Reais
  const totalPeriod = filteredActivities.length;
  const countProgramadas = filteredActivities.filter(
    (a) => a.status === "programada" || a.status === "planejada"
  ).length;
  const countEmAndamento = filteredActivities.filter((a) => a.status === "em_andamento").length;
  const countConcluidas = filteredActivities.filter((a) => a.status === "concluida").length;
  const countAtrasadas = filteredActivities.filter((a) => isActivityDelayed(a, todayISO)).length;
  const countCanceladas = filteredActivities.filter((a) => a.status === "cancelada").length;

  const percCumprimento =
    totalPeriod > 0
      ? Math.round((countConcluidas / (totalPeriod - countCanceladas || 1)) * 100)
      : 0;

  const progressoMedio =
    totalPeriod > 0
      ? Math.round(
          filteredActivities.reduce((acc, curr) => acc + (Number(curr.progressPercentage) || 0), 0) /
            totalPeriod
        )
      : 0;

  // Próximas atividades programadas reais (com plannedStartDate e plannedEndDate)
  const upcomingActivities = useMemo(() => {
    return activities
      .filter((a) => a.status === "programada" || a.status === "planejada" || a.status === "em_andamento")
      .sort((a, b) => a.schedule.plannedStartDate.localeCompare(b.schedule.plannedStartDate))
      .slice(0, 4);
  }, [activities]);

  // Resumo quantitativo global de materiais reais
  const stockSummary = useMemo(() => {
    const total = rawMaterials.length;
    const criticos = rawMaterials.filter((m) => m.status === "critico").length;
    const atencao = rawMaterials.filter((m) => m.status === "atencao").length;
    const adequados = rawMaterials.filter((m) => m.status === "adequado").length;
    return { total, criticos, atencao, adequados };
  }, [rawMaterials]);

  // Materiais que necessitam de atenção/críticos para exibição na tabela
  const criticalMaterials = useMemo(() => {
    return rawMaterials
      .filter((mat) => mat.status === "critico" || mat.status === "atencao")
      .sort((a, b) => a.currentStock - b.currentStock);
  }, [rawMaterials]);

  // Lista consolidada de itens que "Requerem Atenção"
  const attentionItems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      desc: string;
      type: "atraso" | "prazo_proximo" | "material_min";
      linkHref: string;
      actionText: string;
    }> = [];

    // 1. Atividades reais atrasadas (Prazo já expirou)
    activities
      .filter((a) => isActivityDelayed(a, todayISO))
      .forEach((act) => {
        list.push({
          id: `att-act-${act.id}`,
          title: `Atividade em Atraso: ${act.orderNumber}`,
          desc: `${act.name} (Venceu em: ${act.schedule.plannedEndDate}) • Progresso: ${act.progressPercentage}%`,
          type: "atraso",
          linkHref: "/pintura/atividades",
          actionText: "Ver Atividade",
        });
      });

    // 2. Alerta Preventivo: Atividades com Prazo Próximo (Vence hoje ou amanhã, não concluída e progresso < 80%)
    activities
      .filter((a) => {
        if (a.status === "concluida" || a.status === "cancelada") return false;
        // Se já está atrasada, já entrou no filtro 1
        if (isActivityDelayed(a, todayISO)) return false;
        const isExpiringSoon =
          a.schedule.plannedEndDate === todayISO || a.schedule.plannedEndDate === tomorrowISO;
        const isProgressLow = (Number(a.progressPercentage) || 0) < 80;
        return isExpiringSoon && isProgressLow;
      })
      .forEach((act) => {
        list.push({
          id: `att-soon-${act.id}`,
          title: `Prazo Iminente: ${act.orderNumber}`,
          desc: `${act.name} (Término: ${act.schedule.plannedEndDate === todayISO ? "Hoje" : "Amanhã, " + act.schedule.plannedEndDate}) • Progresso atual: ${act.progressPercentage}%`,
          type: "prazo_proximo",
          linkHref: "/pintura/atividades",
          actionText: "Ver Atividade",
        });
      });

    // 3. Materiais reais com saldo crítico (abaixo do estoque mínimo)
    rawMaterials
      .filter((mat) => mat.currentStock < mat.minimumStock)
      .forEach((mat) => {
        list.push({
          id: `att-mat-min-${mat.id}`,
          title: `Estoque Crítico: ${mat.name}`,
          desc: `Saldo atual: ${mat.currentStock} ${mat.unit} | Mínimo exigido: ${mat.minimumStock} ${mat.unit}`,
          type: "material_min",
          linkHref: "/pintura/materiais-estoque",
          actionText: "Ver Estoque",
        });
      });

    return list;
  }, [activities, rawMaterials, todayISO, tomorrowISO]);

  const isLoading = loadingActivities || loadingMaterials;
  const error = errorActivities || errorMaterials;

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO & FILTROS NO TOPO (Dark Premium Industrial) */}
      <div className="bg-[#0f172a] border border-white/10 rounded-lg p-5 space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 pb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Dashboard Operacional da Pintura
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Painel consolidado em tempo real com base nos registros do Supabase.
            </p>
          </div>
          {statusCardFilter && (
            <button
              onClick={() => setStatusCardFilter(null)}
              className="text-xs font-semibold px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded hover:bg-amber-500/20 transition-colors self-start sm:self-auto"
            >
              Filtro ativo: {statusCardFilter} (Limpar ×)
            </button>
          )}
        </div>

        {/* Mensagem de Erro Real (se houver) */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Filtros em linha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Período */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Período</label>
            <div className="grid grid-cols-4 gap-1 bg-[#090d16] p-1 rounded border border-white/10">
              <button
                type="button"
                onClick={() => setPeriod("hoje")}
                className={`py-1 text-xs font-semibold rounded text-center transition-colors ${
                  period === "hoje"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setPeriod("semana")}
                className={`py-1 text-xs font-semibold rounded text-center transition-colors ${
                  period === "semana"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => setPeriod("mes")}
                className={`py-1 text-xs font-semibold rounded text-center transition-colors ${
                  period === "mes"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Mês
              </button>
              <button
                type="button"
                onClick={() => setPeriod("todas")}
                className={`py-1 text-xs font-semibold rounded text-center transition-colors ${
                  period === "todas"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Todas
              </button>
            </div>
          </div>

          {/* Área */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Área</label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="todas">Todas as Áreas ({areasList.length})</option>
              {areasList.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Equipe */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Equipe</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="todas">Todas as Equipes ({teamsList.length})</option>
              {teamsList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Responsável */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Responsável</label>
            <select
              value={selectedResp}
              onChange={(e) => setSelectedResp(e.target.value)}
              className="w-full bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="todos">Todos os Responsáveis ({respList.length})</option>
              {respList.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. CARDS DE RESUMO (7 KPIs REAIS DO TOPO) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total de Atividades */}
        <div
          onClick={() => setStatusCardFilter(null)}
          className={`border rounded-lg p-3.5 transition-all cursor-pointer ${
            !statusCardFilter
              ? "bg-[#090d16] border-emerald-500/50 shadow-[0_0_12px_-2px_rgba(16,185,129,0.2)]"
              : "bg-[#0f172a] border-white/10 hover:border-white/20"
          }`}
        >
          <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
            Total
          </span>
          <p className="text-2xl font-bold font-mono text-slate-100 mt-1">
            {isLoading ? "—" : totalPeriod}
          </p>
          <span className="text-[10px] text-slate-500">atividades</span>
        </div>

        {/* Programadas */}
        <div
          onClick={() => setStatusCardFilter("programadas")}
          className={`border rounded-lg p-3.5 transition-all cursor-pointer ${
            statusCardFilter === "programadas"
              ? "bg-[#090d16] border-emerald-500/50 shadow-[0_0_12px_-2px_rgba(16,185,129,0.2)]"
              : "bg-[#0f172a] border-white/10 hover:border-white/20"
          }`}
        >
          <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
            Programadas
          </span>
          <p className="text-2xl font-bold font-mono text-slate-200 mt-1">
            {isLoading ? "—" : countProgramadas}
          </p>
          <span className="text-[10px] text-slate-500">a iniciar</span>
        </div>

        {/* Em Andamento */}
        <div
          onClick={() => setStatusCardFilter("em_andamento")}
          className={`border rounded-lg p-3.5 transition-all cursor-pointer ${
            statusCardFilter === "em_andamento"
              ? "bg-[#090d16] border-blue-500/50 shadow-[0_0_12px_-2px_rgba(59,130,246,0.2)]"
              : "bg-[#0f172a] border-white/10 hover:border-white/20"
          }`}
        >
          <span className="text-[11px] font-mono font-semibold text-blue-400 uppercase tracking-wider">
            Em Andamento
          </span>
          <p className="text-2xl font-bold font-mono text-blue-400 mt-1">
            {isLoading ? "—" : countEmAndamento}
          </p>
          <span className="text-[10px] text-slate-500">ativas</span>
        </div>

        {/* Concluídas */}
        <div
          onClick={() => setStatusCardFilter("concluidas")}
          className={`border rounded-lg p-3.5 transition-all cursor-pointer ${
            statusCardFilter === "concluidas"
              ? "bg-[#090d16] border-emerald-500/50 shadow-[0_0_12px_-2px_rgba(16,185,129,0.3)]"
              : "bg-[#0f172a] border-white/10 hover:border-white/20"
          }`}
        >
          <span className="text-[11px] font-mono font-semibold text-emerald-400 uppercase tracking-wider">
            Concluídas
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {isLoading ? "—" : countConcluidas}
          </p>
          <span className="text-[10px] text-slate-500">finalizadas</span>
        </div>

        {/* Em Atraso */}
        <div
          onClick={() => setStatusCardFilter("atrasadas")}
          className={`border rounded-lg p-3.5 transition-all cursor-pointer ${
            statusCardFilter === "atrasadas"
              ? "bg-[#090d16] border-rose-500/50 shadow-[0_0_12px_-2px_rgba(244,63,94,0.3)]"
              : "bg-[#0f172a] border-white/10 hover:border-rose-500/30"
          }`}
        >
          <span className="text-[11px] font-mono font-semibold text-rose-400 uppercase tracking-wider">
            Em Atraso
          </span>
          <p className="text-2xl font-bold font-mono text-rose-400 mt-1">
            {isLoading ? "—" : countAtrasadas}
          </p>
          <span className="text-[10px] text-rose-400/80 font-medium">requer ação</span>
        </div>

        {/* % Cumprimento */}
        <div className="bg-[#0f172a] border border-white/10 rounded-lg p-3.5">
          <span className="text-[11px] font-mono font-semibold text-emerald-400 uppercase tracking-wider">
            Cumprimento
          </span>
          <p className="text-2xl font-bold font-mono text-slate-100 mt-1">
            {isLoading ? "—" : `${percCumprimento}%`}
          </p>
          <span className="text-[10px] text-slate-500">meta do escopo</span>
        </div>

        {/* Progresso Médio */}
        <div className="bg-[#0f172a] border border-white/10 rounded-lg p-3.5">
          <span className="text-[11px] font-mono font-semibold text-slate-300 uppercase tracking-wider">
            Progresso Médio
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {isLoading ? "—" : `${progressoMedio}%`}
          </p>
          <span className="text-[10px] text-slate-500">avanço global</span>
        </div>
      </div>

      {/* 3 & 4. SEÇÕES GRÁFICAS (DISTRIBUIÇÃO OPERACIONAL REAL) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Cumprimento da Programação */}
        <div className="bg-[#0f172a] border border-white/10 rounded-lg p-5 space-y-4 shadow-md">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Cumprimento da Programação
            </h2>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-[#090d16] px-2.5 py-0.5 rounded border border-emerald-500/30">
              {isLoading ? "—" : `${percCumprimento}% realizado`}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Total Programado */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-slate-400">Total no Período</span>
                <span className="font-bold text-slate-200">{totalPeriod} frentes</span>
              </div>
              <div className="w-full bg-[#090d16] rounded-full h-2.5 border border-white/5 overflow-hidden">
                <div className="bg-slate-500 h-full w-full" />
              </div>
            </div>

            {/* Concluídas */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-emerald-400">Concluídas</span>
                <span className="font-bold text-emerald-400">
                  {countConcluidas} ({totalPeriod > 0 ? Math.round((countConcluidas / totalPeriod) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-[#090d16] rounded-full h-2.5 border border-white/5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalPeriod > 0 ? (countConcluidas / totalPeriod) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Em Andamento */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-blue-400">Em Andamento</span>
                <span className="font-bold text-blue-400">
                  {countEmAndamento} ({totalPeriod > 0 ? Math.round((countEmAndamento / totalPeriod) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-[#090d16] rounded-full h-2.5 border border-white/5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalPeriod > 0 ? (countEmAndamento / totalPeriod) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Em Atraso */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-rose-400">Em Atraso</span>
                <span className="font-bold text-rose-400">
                  {countAtrasadas} ({totalPeriod > 0 ? Math.round((countAtrasadas / totalPeriod) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-[#090d16] rounded-full h-2.5 border border-white/5 overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalPeriod > 0 ? (countAtrasadas / totalPeriod) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico 2: Distribuição por Status */}
        <div className="bg-[#0f172a] border border-white/10 rounded-lg p-5 space-y-4 shadow-md">
          <div className="border-b border-white/5 pb-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Distribuição Operacional por Status
            </h2>
          </div>

          <div className="space-y-4">
            {/* Barra segmentada */}
            <div className="w-full bg-[#090d16] rounded-lg h-6 flex overflow-hidden border border-white/10">
              {countConcluidas > 0 && (
                <div
                  style={{ width: `${(countConcluidas / (totalPeriod || 1)) * 100}%` }}
                  className="bg-emerald-600 flex items-center justify-center text-[10px] text-white font-bold font-mono"
                  title={`Concluídas: ${countConcluidas}`}
                >
                  {countConcluidas}
                </div>
              )}
              {countEmAndamento > 0 && (
                <div
                  style={{ width: `${(countEmAndamento / (totalPeriod || 1)) * 100}%` }}
                  className="bg-blue-600 flex items-center justify-center text-[10px] text-white font-bold font-mono"
                  title={`Em Andamento: ${countEmAndamento}`}
                >
                  {countEmAndamento}
                </div>
              )}
              {countProgramadas > 0 && (
                <div
                  style={{ width: `${(countProgramadas / (totalPeriod || 1)) * 100}%` }}
                  className="bg-slate-600 flex items-center justify-center text-[10px] text-white font-bold font-mono"
                  title={`Programadas: ${countProgramadas}`}
                >
                  {countProgramadas}
                </div>
              )}
              {countAtrasadas > 0 && (
                <div
                  style={{ width: `${(countAtrasadas / (totalPeriod || 1)) * 100}%` }}
                  className="bg-rose-600 flex items-center justify-center text-[10px] text-white font-bold font-mono"
                  title={`Atrasadas: ${countAtrasadas}`}
                >
                  {countAtrasadas}
                </div>
              )}
            </div>

            {/* Legenda */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600 shrink-0" />
                <span className="text-slate-400">Concluídas: <strong className="text-slate-200">{countConcluidas}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded bg-blue-600 shrink-0" />
                <span className="text-slate-400">Andamento: <strong className="text-slate-200">{countEmAndamento}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded bg-slate-600 shrink-0" />
                <span className="text-slate-400">Programadas: <strong className="text-slate-200">{countProgramadas}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded bg-rose-600 shrink-0" />
                <span className="text-slate-400">Atrasadas: <strong className="text-slate-200">{countAtrasadas}</strong></span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 pt-2 border-t border-white/5">
              Progresso médio consolidado: <strong className="text-slate-300 font-mono">{progressoMedio}%</strong>
            </p>
          </div>
        </div>
      </div>

      {/* 5. SEÇÃO: REQUER ATENÇÃO (Ações Prioritárias Reais & Alertas Preventivos) */}
      <div className="bg-[#0f172a] border border-white/10 rounded-lg p-5 space-y-3 shadow-md">
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <span>🚨</span> Requer Atenção Operacional ({attentionItems.length})
          </h2>
          <span className="text-[11px] text-slate-400">Ações imediatas e preventivas de prazos e estoque</span>
        </div>

        {attentionItems.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center font-mono">
            Nenhuma inconsistência de prazo, atraso ou estoque crítico detectada no momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#090d16] border border-white/10 rounded-md p-3.5 flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-100 leading-snug">{item.title}</h3>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                        item.type === "atraso"
                          ? "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                          : item.type === "prazo_proximo"
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                          : "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {item.type === "atraso" ? "🔴 Atraso" : item.type === "prazo_proximo" ? "🟡 Prazo Próximo" : "🔴 Estoque Crítico"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                </div>
                <div className="pt-2 border-t border-white/5 flex justify-end">
                  <Link
                    href={item.linkHref}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {item.actionText} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6 & 7. PRÓXIMAS ATIVIDADES & SITUAÇÃO DO ESTOQUE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 6. Próximas Atividades (com Início e Término) */}
        <div className="bg-[#0f172a] border border-white/10 rounded-lg p-5 space-y-3 shadow-md">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Próximas Atividades Programadas
            </h2>
            <Link href="/pintura/atividades" className="text-xs font-bold text-emerald-400 hover:underline">
              Ver todas →
            </Link>
          </div>

          {upcomingActivities.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Nenhuma atividade programada cadastrada.</p>
          ) : (
            <div className="divide-y divide-white/5 text-xs">
              {upcomingActivities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => setSelectedActivity(act)}
                  className="py-2.5 flex items-center justify-between hover:bg-white/5 cursor-pointer px-2 rounded transition-colors"
                >
                  <div className="space-y-0.5 max-w-[70%]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-emerald-400">{act.orderNumber}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {act.schedule.plannedStartDate} até {act.schedule.plannedEndDate}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-100 truncate">{act.name}</p>
                    <p className="text-[11px] text-slate-400">{act.location?.area || "Área geral"}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <ActivityStatusBadge status={act.status} />
                    <span className="block text-[11px] font-mono font-bold text-slate-300">
                      {act.progressPercentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Situação do Estoque (Resumo Compacto + Tabela de Atenção) */}
        <div className="bg-[#0f172a] border border-white/10 rounded-lg p-5 space-y-4 shadow-md">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Situação dos Materiais & Estoque
            </h2>
            <Link href="/pintura/materiais-estoque" className="text-xs font-bold text-emerald-400 hover:underline">
              Catálogo completo →
            </Link>
          </div>

          {/* Mini-Cards de Resumo Global de Estoque */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-[#090d16] border border-white/10 rounded p-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Total</span>
              <span className="text-sm font-bold font-mono text-slate-100">{stockSummary.total}</span>
            </div>
            <div className="bg-[#090d16] border border-emerald-500/30 rounded p-2">
              <span className="text-[10px] font-mono text-emerald-400 uppercase block">Adequados</span>
              <span className="text-sm font-bold font-mono text-emerald-400">{stockSummary.adequados}</span>
            </div>
            <div className="bg-[#090d16] border border-amber-500/30 rounded p-2">
              <span className="text-[10px] font-mono text-amber-400 uppercase block">Atenção</span>
              <span className="text-sm font-bold font-mono text-amber-400">{stockSummary.atencao}</span>
            </div>
            <div className="bg-[#090d16] border border-rose-500/30 rounded p-2">
              <span className="text-[10px] font-mono text-rose-400 uppercase block">Críticos</span>
              <span className="text-sm font-bold font-mono text-rose-400">{stockSummary.criticos}</span>
            </div>
          </div>

          {/* Tabela de Insumos Críticos / Atenção */}
          {criticalMaterials.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center font-mono">
              Todos os materiais cadastrados estão com saldo adequado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-[10px] uppercase font-mono font-bold text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="pb-2">Material</th>
                    <th className="pb-2">Saldo Atual</th>
                    <th className="pb-2">Estoque Mínimo</th>
                    <th className="pb-2">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {criticalMaterials.map((mat) => (
                    <tr key={mat.id} className="py-2 hover:bg-white/5">
                      <td className="py-2.5 font-semibold text-slate-100 pr-2 max-w-[160px] truncate" title={mat.name}>
                        {mat.name}
                      </td>
                      <td className="py-2.5 font-mono font-bold text-slate-200">
                        {mat.currentStock} {mat.unit}
                      </td>
                      <td className="py-2.5 font-mono text-slate-400">
                        {mat.minimumStock} {mat.unit}
                      </td>
                      <td className="py-2.5">
                        {mat.status === "critico" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#090d16] text-rose-400 border border-rose-500/30 rounded text-[10px] font-mono uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Crítico
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#090d16] text-amber-400 border border-amber-500/30 rounded text-[10px] font-mono uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Atenção
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal / Drawer de Detalhes da Atividade quando clicada no Dashboard */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xl w-full">
            <ActivityDetails
              activity={selectedActivity}
              onUpdateActivity={updateActivity}
              onArchiveActivity={archiveActivity}
              onClose={() => setSelectedActivity(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
