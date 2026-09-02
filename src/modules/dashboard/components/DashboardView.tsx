"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useActivities } from "@/modules/atividades/hooks/useActivities";
import { useMaterials } from "@/modules/materiais/hooks/useMaterials";
import { isActivityDelayed } from "@/modules/atividades/rules/activity.rules";
import { ActivityStatusBadge } from "@/modules/atividades/components/ActivityStatusBadge";
import { Activity } from "@/modules/atividades/types/activity.types";
import { formatDateISO, getWeekInfo } from "@/modules/atividades/utils/week.utils";

export function DashboardView() {
  const {
    activities,
    isLoading: loadingActivities,
    error: errorActivities,
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
  const [, setSelectedActivity] = useState<Activity | null>(null);

  // Data atual real
  const todayISO = useMemo(() => formatDateISO(new Date()), []);
  const tomorrowISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateISO(d);
  }, []);
  const currentWeek = useMemo(() => getWeekInfo(new Date(), true), []);

  // Lista dinâmica de Áreas reais
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
      if (period === "hoje") {
        const isToday =
          act.schedule.plannedStartDate === todayISO ||
          (act.status === "em_andamento" &&
            act.schedule.plannedStartDate <= todayISO &&
            act.schedule.plannedEndDate >= todayISO);
        if (!isToday) return false;
      } else if (period === "semana") {
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

      if (selectedArea !== "todas" && act.location?.area !== selectedArea) {
        return false;
      }

      if (selectedTeam !== "todas" && act.team !== selectedTeam) {
        return false;
      }

      if (selectedResp !== "todos" && act.assignedTo !== selectedResp) {
        return false;
      }

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

  // Próximas atividades programadas reais
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

  // Materiais críticos
  const criticalMaterials = useMemo(() => {
    return rawMaterials
      .filter((mat) => mat.status === "critico" || mat.status === "atencao")
      .sort((a, b) => a.currentStock - b.currentStock);
  }, [rawMaterials]);

  // Itens que "Requerem Atenção"
  const attentionItems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      desc: string;
      type: "atraso" | "prazo_proximo" | "material_min";
      linkHref: string;
      actionText: string;
    }> = [];

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

    activities
      .filter((a) => {
        if (a.status === "concluida" || a.status === "cancelada") return false;
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
      {/* 1. CABEÇALHO & FILTROS NO TOPO (Identidade Clara e Profissional RSS3) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Dashboard Operacional da Pintura
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Painel consolidado em tempo real com base nos registros da RSS3 Soluções Industriais.
            </p>
          </div>
          {statusCardFilter && (
            <button
              onClick={() => setStatusCardFilter(null)}
              className="text-xs font-semibold px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-md hover:bg-orange-100 transition-colors self-start sm:self-auto"
            >
              Filtro ativo: {statusCardFilter} (Limpar ×)
            </button>
          )}
        </div>

        {/* Mensagem de Erro Real (se houver) */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 font-mono">
            {error}
          </div>
        )}

        {/* Filtros em linha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Período */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Período</label>
            <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setPeriod("hoje")}
                className={`py-1 text-xs font-semibold rounded text-center transition-colors ${
                  period === "hoje"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setPeriod("semana")}
                className={`py-1 text-xs font-semibold rounded text-center transition-colors ${
                  period === "semana"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => setPeriod("mes")}
                className={`py-1 text-xs font-semibold rounded text-center transition-colors ${
                  period === "mes"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mês
              </button>
              <button
                type="button"
                onClick={() => setPeriod("todas")}
                className={`py-1 text-xs font-semibold rounded text-center transition-colors ${
                  period === "todas"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Todas
              </button>
            </div>
          </div>

          {/* Área */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Área</label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full bg-white text-slate-900 border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
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
            <label className="block font-semibold text-slate-700 mb-1">Equipe</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full bg-white text-slate-900 border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
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
            <label className="block font-semibold text-slate-700 mb-1">Responsável</label>
            <select
              value={selectedResp}
              onChange={(e) => setSelectedResp(e.target.value)}
              className="w-full bg-white text-slate-900 border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
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
          className={`border rounded-lg p-3.5 transition-all cursor-pointer bg-white shadow-xs ${
            !statusCardFilter
              ? "border-blue-500 ring-1 ring-blue-400 bg-blue-50/20"
              : "border-slate-200 hover:border-blue-300"
          }`}
        >
          <span className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
            Total
          </span>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {isLoading ? "—" : totalPeriod}
          </p>
          <span className="text-[10px] text-slate-500">atividades</span>
        </div>

        {/* Programadas */}
        <div
          onClick={() => setStatusCardFilter("programadas")}
          className={`border rounded-lg p-3.5 transition-all cursor-pointer bg-white shadow-xs ${
            statusCardFilter === "programadas"
              ? "border-blue-500 ring-1 ring-blue-400 bg-blue-50/20"
              : "border-slate-200 hover:border-blue-300"
          }`}
        >
          <span className="text-[11px] font-mono font-semibold text-blue-700 uppercase tracking-wider">
            Programadas
          </span>
          <p className="text-2xl font-bold font-mono text-blue-700 mt-1">
            {isLoading ? "—" : countProgramadas}
          </p>
          <span className="text-[10px] text-slate-500">a iniciar</span>
        </div>

        {/* Em Andamento */}
        <div
          onClick={() => setStatusCardFilter("em_andamento")}
          className={`border rounded-lg p-3.5 transition-all cursor-pointer bg-white shadow-xs ${
            statusCardFilter === "em_andamento"
              ? "border-orange-500 ring-1 ring-orange-400 bg-orange-50/20"
              : "border-slate-200 hover:border-orange-300"
          }`}
        >
          <span className="text-[11px] font-mono font-semibold text-orange-600 uppercase tracking-wider">
            Em Andamento
          </span>
          <p className="text-2xl font-bold font-mono text-orange-600 mt-1">
            {isLoading ? "—" : countEmAndamento}
          </p>
          <span className="text-[10px] text-slate-500">ativas</span>
        </div>

        {/* Concluídas */}
        <div
          onClick={() => setStatusCardFilter("concluidas")}
          className={`border rounded-lg p-3.5 transition-all cursor-pointer bg-white shadow-xs ${
            statusCardFilter === "concluidas"
              ? "border-emerald-500 ring-1 ring-emerald-400 bg-emerald-50/20"
              : "border-slate-200 hover:border-emerald-300"
          }`}
        >
          <span className="text-[11px] font-mono font-semibold text-emerald-600 uppercase tracking-wider">
            Concluídas
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">
            {isLoading ? "—" : countConcluidas}
          </p>
          <span className="text-[10px] text-slate-500">finalizadas</span>
        </div>

        {/* Em Atraso */}
        <div
          onClick={() => setStatusCardFilter("atrasadas")}
          className={`border rounded-lg p-3.5 transition-all cursor-pointer bg-white shadow-xs ${
            statusCardFilter === "atrasadas"
              ? "border-rose-500 ring-1 ring-rose-400 bg-rose-50/20"
              : "border-slate-200 hover:border-rose-300"
          }`}
        >
          <span className="text-[11px] font-mono font-semibold text-rose-600 uppercase tracking-wider">
            Em Atraso
          </span>
          <p className="text-2xl font-bold font-mono text-rose-600 mt-1">
            {isLoading ? "—" : countAtrasadas}
          </p>
          <span className="text-[10px] text-rose-600 font-medium">requer ação</span>
        </div>

        {/* % Cumprimento */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[11px] font-mono font-semibold text-blue-700 uppercase tracking-wider">
            Cumprimento
          </span>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {isLoading ? "—" : `${percCumprimento}%`}
          </p>
          <span className="text-[10px] text-slate-500">meta do escopo</span>
        </div>

        {/* Progresso Médio */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[11px] font-mono font-semibold text-blue-700 uppercase tracking-wider">
            Progresso Médio
          </span>
          <p className="text-2xl font-bold font-mono text-blue-700 mt-1">
            {isLoading ? "—" : `${progressoMedio}%`}
          </p>
          <span className="text-[10px] text-slate-500">avanço global</span>
        </div>
      </div>

      {/* 3 & 4. SEÇÕES GRÁFICAS (DISTRIBUIÇÃO OPERACIONAL) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Cumprimento da Programação */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
              Cumprimento da Programação
            </h2>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
              {isLoading ? "—" : `${percCumprimento}% realizado`}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Total Programado */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-slate-600">Total no Período</span>
                <span className="font-bold text-slate-900">{totalPeriod} frentes</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 border border-slate-200 overflow-hidden">
                <div className="bg-slate-400 h-full w-full" />
              </div>
            </div>

            {/* Concluídas */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-emerald-700">Concluídas</span>
                <span className="font-bold text-emerald-700">
                  {countConcluidas} ({totalPeriod > 0 ? Math.round((countConcluidas / totalPeriod) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 border border-slate-200 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalPeriod > 0 ? (countConcluidas / totalPeriod) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Em Andamento */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-orange-700">Em Andamento</span>
                <span className="font-bold text-orange-700">
                  {countEmAndamento} ({totalPeriod > 0 ? Math.round((countEmAndamento / totalPeriod) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 border border-slate-200 overflow-hidden">
                <div
                  className="bg-orange-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalPeriod > 0 ? (countEmAndamento / totalPeriod) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Em Atraso */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-rose-700">Em Atraso</span>
                <span className="font-bold text-rose-700">
                  {countAtrasadas} ({totalPeriod > 0 ? Math.round((countAtrasadas / totalPeriod) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 border border-slate-200 overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalPeriod > 0 ? (countAtrasadas / totalPeriod) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico 2: Distribuição por Status */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
              Distribuição Operacional por Status
            </h2>
          </div>

          <div className="space-y-4">
            {/* Barra segmentada */}
            <div className="w-full bg-slate-100 rounded-lg h-6 flex overflow-hidden border border-slate-200">
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
                  className="bg-orange-500 flex items-center justify-center text-[10px] text-white font-bold font-mono"
                  title={`Em Andamento: ${countEmAndamento}`}
                >
                  {countEmAndamento}
                </div>
              )}
              {countProgramadas > 0 && (
                <div
                  style={{ width: `${(countProgramadas / (totalPeriod || 1)) * 100}%` }}
                  className="bg-blue-600 flex items-center justify-center text-[10px] text-white font-bold font-mono"
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
                <span className="text-slate-600">Concluídas: <strong className="text-slate-900">{countConcluidas}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded bg-orange-500 shrink-0" />
                <span className="text-slate-600">Andamento: <strong className="text-slate-900">{countEmAndamento}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded bg-blue-600 shrink-0" />
                <span className="text-slate-600">Programadas: <strong className="text-slate-900">{countProgramadas}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded bg-rose-600 shrink-0" />
                <span className="text-slate-600">Atrasadas: <strong className="text-slate-900">{countAtrasadas}</strong></span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              Progresso médio consolidado: <strong className="text-blue-700 font-mono">{progressoMedio}%</strong>
            </p>
          </div>
        </div>
      </div>

      {/* 5. SEÇÃO: REQUER ATENÇÃO */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 shadow-xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <span>🚨</span> Requer Atenção Operacional ({attentionItems.length})
          </h2>
          <span className="text-[11px] text-slate-500">Ações imediatas e preventivas de prazos e estoque</span>
        </div>

        {attentionItems.length === 0 ? (
          <p className="text-xs text-slate-500 py-3 text-center font-mono">
            Nenhuma inconsistência de prazo, atraso ou estoque crítico detectada no momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900 leading-snug">{item.title}</h3>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                        item.type === "atraso"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : item.type === "prazo_proximo"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {item.type === "atraso" ? "🔴 Atraso" : item.type === "prazo_proximo" ? "🟡 Prazo Próximo" : "🔴 Estoque Crítico"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-end">
                  <Link
                    href={item.linkHref}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 transition-colors"
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
        {/* 6. Próximas Atividades */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
              Próximas Atividades Programadas
            </h2>
            <Link href="/pintura/atividades" className="text-xs font-bold text-blue-600 hover:underline">
              Ver todas →
            </Link>
          </div>

          {upcomingActivities.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center font-mono">Nenhuma atividade programada cadastrada.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {upcomingActivities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => setSelectedActivity(act)}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer px-2 rounded transition-colors"
                >
                  <div className="space-y-0.5 max-w-[70%]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-blue-700">{act.orderNumber}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {act.schedule.plannedStartDate} até {act.schedule.plannedEndDate}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 truncate">{act.name}</p>
                    <p className="text-[11px] text-slate-500">{act.location?.area || "Área geral"}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <ActivityStatusBadge status={act.status} />
                    <span className="block text-[11px] font-mono font-bold text-blue-700">
                      {act.progressPercentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Situação do Estoque */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
              Situação dos Materiais & Estoque
            </h2>
            <Link href="/pintura/materiais-estoque" className="text-xs font-bold text-blue-600 hover:underline">
              Catálogo completo →
            </Link>
          </div>

          {/* Mini-Cards de Resumo */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Total</span>
              <span className="text-sm font-bold font-mono text-slate-900">{stockSummary.total}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
              <span className="text-[10px] font-mono text-emerald-700 uppercase block">Adequados</span>
              <span className="text-sm font-bold font-mono text-emerald-700">{stockSummary.adequados}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-2">
              <span className="text-[10px] font-mono text-amber-700 uppercase block">Atenção</span>
              <span className="text-sm font-bold font-mono text-amber-700">{stockSummary.atencao}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded p-2">
              <span className="text-[10px] font-mono text-rose-700 uppercase block">Críticos</span>
              <span className="text-sm font-bold font-mono text-rose-700">{stockSummary.criticos}</span>
            </div>
          </div>

          {/* Tabela de Insumos Críticos */}
          {criticalMaterials.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center font-mono">
              Todos os materiais cadastrados estão com saldo adequado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-[10px] uppercase font-mono font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="pb-2">Material</th>
                    <th className="pb-2">Saldo Atual</th>
                    <th className="pb-2">Estoque Mínimo</th>
                    <th className="pb-2">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {criticalMaterials.map((mat) => (
                    <tr key={mat.id} className="py-2 hover:bg-slate-50">
                      <td className="py-2.5 font-semibold text-slate-900 pr-2 max-w-[160px] truncate" title={mat.name}>
                        {mat.name}
                      </td>
                      <td className="py-2.5 font-mono font-bold text-slate-800">
                        {mat.currentStock} {mat.unit}
                      </td>
                      <td className="py-2.5 font-mono text-slate-500">
                        {mat.minimumStock} {mat.unit}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                            mat.status === "critico"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {mat.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
