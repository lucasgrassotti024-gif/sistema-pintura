"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useActivities } from "@/modules/atividades/hooks/useActivities";
import { useMaterials } from "@/modules/materiais/hooks/useMaterials";
import { isActivityDelayed } from "@/modules/atividades/rules/activity.rules";
import { ActivityStatusBadge } from "@/modules/atividades/components/ActivityStatusBadge";
import { formatDateISO, getWeekInfo } from "@/modules/atividades/utils/week.utils";

export default function PinturaInicioPage() {
  const { activities, isLoading: loadingActivities, error: errorActivities } = useActivities();
  const { rawMaterials, isLoading: loadingMaterials, error: errorMaterials } = useMaterials();

  // Data atual real e Semana de Seg a Sex
  const todayISO = useMemo(() => formatDateISO(new Date()), []);
  const todayFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, []);

  const weekInfo = useMemo(() => getWeekInfo(new Date(), false), []); // 5 dias úteis (Seg a Sex)

  // 1. Atividades de Hoje (reais)
  const activitiesToday = useMemo(() => {
    return activities.filter((act) => {
      if (act.status === "cancelada") return false;
      const isStartingToday = act.schedule.plannedStartDate === todayISO;
      const isOngoingToday =
        act.status === "em_andamento" &&
        act.schedule.plannedStartDate <= todayISO &&
        act.schedule.plannedEndDate >= todayISO;
      return isStartingToday || isOngoingToday;
    });
  }, [activities, todayISO]);

  // 2. Atividades Atrasadas (reais)
  const delayedActivities = useMemo(() => {
    return activities.filter((act) => isActivityDelayed(act, todayISO));
  }, [activities, todayISO]);

  // 3. Resumo Executivo das Atividades
  const activeActivitiesCount = useMemo(() => {
    return activities.filter((a) => a.status === "em_andamento" || a.status === "programada" || a.status === "planejada").length;
  }, [activities]);

  const progressoGeral = useMemo(() => {
    if (activities.length === 0) return 0;
    const total = activities.reduce((acc, curr) => acc + (Number(curr.progressPercentage) || 0), 0);
    return Math.round(total / activities.length);
  }, [activities]);

  // 4. Resumo Executivo de Estoque (reais de public.materials)
  const stockSummary = useMemo(() => {
    const total = rawMaterials.length;
    const criticos = rawMaterials.filter((m) => m.status === "critico").length;
    const atencao = rawMaterials.filter((m) => m.status === "atencao").length;
    const adequados = rawMaterials.filter((m) => m.status === "adequado").length;
    return { total, criticos, atencao, adequados };
  }, [rawMaterials]);

  // 5. Contagem de frentes por dia da semana atual (Segunda a Sexta)
  const weekDaysActivities = useMemo(() => {
    return weekInfo.days.map((day) => {
      const count = activities.filter((act) => {
        if (act.status === "cancelada") return false;
        return act.schedule.plannedStartDate <= day.date && act.schedule.plannedEndDate >= day.date;
      }).length;

      return {
        ...day,
        count,
      };
    });
  }, [weekInfo, activities]);

  // Atalhos Rápidos (rotas reais com contadores dinâmicos reais)
  const shortcuts = useMemo(() => [
    {
      title: "Programação",
      href: "/pintura/programacao",
      badge: "Cronograma Semanal",
      desc: "Distribuição dos 5 dias úteis",
    },
    {
      title: "Atividades",
      href: "/pintura/atividades",
      badge: `${activities.length} cadastradas`,
      desc: "Gestão operacional de frentes",
    },
    {
      title: "Materiais & Estoque",
      href: "/pintura/materiais-estoque",
      badge: `${rawMaterials.length} insumos`,
      desc: "Catálogo e movimentações",
    },
    {
      title: "Assistente IA",
      href: "/pintura/ia",
      badge: "Apoio Técnico",
      desc: "Consultas operacionais",
    },
    {
      title: "Dashboard",
      href: "/pintura/dashboard",
      badge: "Indicadores & KPIs",
      desc: "Análise profunda de desempenho",
    },
  ], [activities.length, rawMaterials.length]);

  const isLoading = loadingActivities || loadingMaterials;
  const error = errorActivities || errorMaterials;

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO DA CENTRAL OPERACIONAL (Identidade RSS3 Azul / Laranja) */}
      <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Visão Geral da Pintura
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30">
              Operação em Tempo Real
            </span>
          </div>
          <p className="text-xs text-blue-300/80 mt-1 capitalize font-mono">
            {todayFormatted} • {weekInfo.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pintura/programacao"
            className="text-xs font-bold px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded transition-all shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)]"
          >
            Abrir Programação →
          </Link>
        </div>
      </div>

      {/* Diagnóstico de Erro Real (se houver) */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* 2. RESUMO EXECUTIVO (4 Blocos com Paleta RSS3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Atividades Ativas */}
        <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-semibold text-blue-400 uppercase tracking-wider">
            Frentes Ativas
          </span>
          <p className="text-2xl font-bold font-mono text-white mt-1">
            {isLoading ? "—" : activeActivitiesCount}
          </p>
          <span className="text-[10px] text-slate-400">em andamento / programadas</span>
        </div>

        {/* Progresso Geral */}
        <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-semibold text-orange-400 uppercase tracking-wider">
            Progresso Geral
          </span>
          <p className="text-2xl font-bold font-mono text-orange-400 mt-1">
            {isLoading ? "—" : `${progressoGeral}%`}
          </p>
          <span className="text-[10px] text-slate-400">avanço médio de todas as OSs</span>
        </div>

        {/* Atrasos Ativos */}
        <div className="bg-[#0c1524] border border-rose-500/30 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-semibold text-rose-400 uppercase tracking-wider">
            Frentes Atrasadas
          </span>
          <p className="text-2xl font-bold font-mono text-rose-400 mt-1">
            {isLoading ? "—" : delayedActivities.length}
          </p>
          <span className="text-[10px] text-rose-400/80">com prazo final vencido</span>
        </div>

        {/* Estoque Crítico */}
        <div className="bg-[#0c1524] border border-amber-500/30 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-semibold text-amber-400 uppercase tracking-wider">
            Insumos em Atenção / Críticos
          </span>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {isLoading ? "—" : stockSummary.criticos + stockSummary.atencao}
          </p>
          <span className="text-[10px] text-slate-400">de {stockSummary.total} materiais cadastrados</span>
        </div>
      </div>

      {/* 3. RESUMO DA PROGRAMAÇÃO DA SEMANA ATUAL (Segunda a Sexta) */}
      <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-4 sm:p-5 space-y-3 shadow-md">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-blue-500/15 pb-2 gap-1">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              Programação da Semana ({weekInfo.startDate} a {weekInfo.endDate})
            </h2>
            <p className="text-[11px] text-slate-400">Distribuição diária de frentes de trabalho</p>
          </div>
          <Link
            href="/pintura/programacao"
            className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors self-start sm:self-auto"
          >
            Ver grade completa →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          {weekDaysActivities.map((day) => (
            <Link
              key={day.date}
              href="/pintura/programacao"
              className={`p-3 rounded-lg border transition-all flex flex-col justify-between ${
                day.isToday
                  ? "bg-[#131f33] border-orange-500/60 shadow-[0_0_15px_-2px_rgba(249,115,22,0.3)] ring-1 ring-orange-500/40"
                  : "bg-[#070c14] border-blue-500/15 hover:border-blue-500/35 hover:bg-[#131f33]/40"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className={`text-xs font-bold ${day.isToday ? "text-orange-400 font-mono" : "text-slate-200"}`}>
                  {day.dayOfWeek}
                </span>
                <span className="text-[10px] font-mono text-slate-400">{day.label}</span>
              </div>
              <div className="mt-3">
                <span className="text-xl font-bold font-mono text-white">{day.count}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {day.count === 1 ? "frente programada" : "frentes programadas"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 4. GRID OPERACIONAL: ATIVIDADES DE HOJE + ATIVIDADES ATRASADAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividades de Hoje */}
        <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-4 sm:p-5 space-y-3 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-blue-500/15 pb-2">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <span>📅</span> Atividades de Hoje ({activitiesToday.length})
              </h2>
              <Link href="/pintura/atividades" className="text-xs font-bold text-orange-400 hover:underline">
                Gerenciar →
              </Link>
            </div>

            {activitiesToday.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center font-mono">
                Nenhuma atividade programada para hoje ({todayISO}).
              </p>
            ) : (
              <div className="divide-y divide-blue-500/10 text-xs">
                {activitiesToday.map((act) => (
                  <div key={act.id} className="py-2.5 space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-mono font-bold text-blue-400">{act.orderNumber}</span>
                      <ActivityStatusBadge status={act.status} />
                    </div>
                    <p className="font-semibold text-white leading-snug">{act.name}</p>
                    <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                      <span className="truncate max-w-[200px]">{act.location?.area || "Área geral"} • Resp: {act.assignedTo || "—"}</span>
                      <span className="font-mono font-bold text-orange-400 shrink-0">{act.progressPercentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-blue-500/15 text-right">
            <Link
              href="/pintura/programacao"
              className="text-xs text-slate-400 hover:text-orange-400 transition-colors inline-flex items-center gap-1"
            >
              Ver na Programação Semanal →
            </Link>
          </div>
        </div>

        {/* Atividades Atrasadas */}
        <div className="bg-[#0c1524] border border-rose-500/30 rounded-lg p-4 sm:p-5 space-y-3 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-rose-500/20 pb-2">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <span>⚠️</span> Atividades Atrasadas ({delayedActivities.length})
              </h2>
              <Link href="/pintura/atividades" className="text-xs font-bold text-rose-400 hover:underline">
                Ver todas →
              </Link>
            </div>

            {delayedActivities.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center font-mono">
                Nenhuma atividade em atraso no momento.
              </p>
            ) : (
              <div className="divide-y divide-blue-500/10 text-xs">
                {delayedActivities.map((act) => (
                  <div key={act.id} className="py-2.5 space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-mono font-bold text-rose-400">{act.orderNumber}</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 shrink-0">
                        Venceu em {act.schedule.plannedEndDate}
                      </span>
                    </div>
                    <p className="font-semibold text-white leading-snug">{act.name}</p>
                    <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>Progresso: {act.progressPercentage}%</span>
                      <span className="truncate max-w-[150px]">{act.location?.area || "Área geral"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-blue-500/15 text-right">
            <Link
              href="/pintura/atividades"
              className="text-xs text-slate-400 hover:text-rose-300 transition-colors inline-flex items-center gap-1"
            >
              Replanejar ou Atualizar Atividades →
            </Link>
          </div>
        </div>
      </div>

      {/* 5. ATALHOS RÁPIDOS (Padrão RSS3) */}
      <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-4 sm:p-5 space-y-3 shadow-md">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 border-b border-blue-500/15 pb-2">
          Módulos & Acessos Rápidos RSS3
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="p-3.5 bg-[#070c14] border border-blue-500/15 rounded-lg hover:border-orange-500/50 hover:bg-[#131f33]/40 transition-all block group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors block truncate">
                  {s.title}
                </span>
                <span className="text-[10px] text-blue-400 font-mono group-hover:text-orange-400">→</span>
              </div>
              <span className="text-[10px] font-mono text-orange-400 block mt-1">
                {s.badge}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5 leading-snug">
                {s.desc}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
