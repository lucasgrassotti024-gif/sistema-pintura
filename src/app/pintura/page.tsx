"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useActivities } from "@/modules/atividades/hooks/useActivities";
import { useMaterials } from "@/modules/materiais/hooks/useMaterials";
import { isActivityDelayed } from "@/modules/atividades/rules/activity.rules";
import { formatDateISO, getWeekInfo } from "@/modules/atividades/utils/week.utils";
import { ActivityStatusBadge } from "@/modules/atividades/components/ActivityStatusBadge";

export default function PinturaOverviewPage() {
  const { activities, isLoading: loadingActivities, error: errorActivities } = useActivities();
  const { materials, isLoading: loadingMaterials, error: errorMaterials } = useMaterials();

  const todayISO = useMemo(() => formatDateISO(new Date()), []);
  const currentWeek = useMemo(() => getWeekInfo(new Date(), false), []);

  // Métricas de Atividades Reais
  const totalActivities = activities.length;
  const inProgressActivities = activities.filter((a) => a.status === "em_andamento");
  const delayedActivities = activities.filter((a) => isActivityDelayed(a, todayISO));
  const completedActivities = activities.filter((a) => a.status === "concluida");

  // Métricas de Materiais Reais
  const criticalMaterials = materials.filter(
    (m) => m.active && m.currentStock < m.minimumStock
  );

  const isLoading = loadingActivities || loadingMaterials;
  const hasError = errorActivities || errorMaterials;

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO DA VISÃO GERAL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-blue-500/15">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Visão Geral da Pintura Industrial
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
              Planta Ativa
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Resumo consolidado em tempo real das ordens de serviço, cronograma semanal e estoque da RSS3.
          </p>
        </div>

        {/* Ações Rápidas em Destaque */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/pintura/atividades"
            className="text-xs font-bold px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Adicionar Atividade</span>
          </Link>
          <Link
            href="/pintura/dashboard"
            className="text-xs font-semibold px-3 py-2 bg-[#0c1524] hover:bg-blue-500/15 text-slate-200 rounded border border-blue-500/20 transition-colors"
          >
            Ver Dashboard Completo →
          </Link>
        </div>
      </div>

      {hasError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 font-mono">
          {hasError}
        </div>
      )}

      {/* 2. CARDS DE RESUMO OPERACIONAL (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Frentes em Andamento */}
        <div className="bg-[#0c1524] border border-blue-500/15 rounded-lg p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 font-mono">
            <span>EM ANDAMENTO</span>
            <span className="text-orange-400">●</span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-bold font-mono text-orange-400">
              {isLoading ? "—" : inProgressActivities.length}
            </span>
            <span className="text-xs text-slate-400">frentes ativas</span>
          </div>
          <span className="text-[11px] text-slate-500 block pt-1 border-t border-blue-500/10">
            {totalActivities} cadastradas no total
          </span>
        </div>

        {/* Card 2: Frentes com Atraso */}
        <div className="bg-[#0c1524] border border-blue-500/15 rounded-lg p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 font-mono">
            <span>EM ATRASO</span>
            <span className="text-rose-400">●</span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-bold font-mono text-rose-400">
              {isLoading ? "—" : delayedActivities.length}
            </span>
            <span className="text-xs text-slate-400">requerem ação</span>
          </div>
          <span className="text-[11px] text-slate-500 block pt-1 border-t border-blue-500/10">
            Data limite vencida
          </span>
        </div>

        {/* Card 3: Concluídas */}
        <div className="bg-[#0c1524] border border-blue-500/15 rounded-lg p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 font-mono">
            <span>CONCLUÍDAS</span>
            <span className="text-emerald-400">●</span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {isLoading ? "—" : completedActivities.length}
            </span>
            <span className="text-xs text-slate-400">finalizadas</span>
          </div>
          <span className="text-[11px] text-slate-500 block pt-1 border-t border-blue-500/10">
            {totalActivities > 0 ? Math.round((completedActivities.length / totalActivities) * 100) : 0}% do escopo
          </span>
        </div>

        {/* Card 4: Insumos Críticos */}
        <div className="bg-[#0c1524] border border-blue-500/15 rounded-lg p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 font-mono">
            <span>ESTOQUE CRÍTICO</span>
            <span className="text-amber-400">●</span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-bold font-mono text-white">
              {isLoading ? "—" : criticalMaterials.length}
            </span>
            <span className="text-xs text-slate-400">materiais</span>
          </div>
          <span className="text-[11px] text-slate-500 block pt-1 border-t border-blue-500/10">
            Abaixo do estoque mínimo
          </span>
        </div>
      </div>

      {/* 3. PROGRAMAÇÃO SEMANAL RESUMIDA */}
      <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-5 shadow-md space-y-4">
        <div className="flex justify-between items-center border-b border-blue-500/15 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              Programação da Semana
            </h2>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {currentWeek.label}
            </span>
          </div>
          <Link
            href="/pintura/programacao"
            className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
          >
            Quadro Completo →
          </Link>
        </div>

        {/* Grid dos 5 Dias Úteis da Semana */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {currentWeek.days.map((day) => {
            const dayActs = activities.filter(
              (a) => a.schedule.plannedStartDate <= day.date && a.schedule.plannedEndDate >= day.date
            );

            return (
              <div
                key={day.date}
                className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                  day.isToday
                    ? "bg-[#131f33] border-orange-500/60 shadow-[0_0_12px_rgba(249,115,22,0.2)] ring-1 ring-orange-500/40"
                    : "bg-[#070c14] border-blue-500/15"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-bold ${day.isToday ? "text-orange-400" : "text-slate-200"}`}>
                      {day.dayOfWeek}
                    </span>
                    {day.isToday && (
                      <span className="text-[9px] uppercase font-bold bg-orange-500/20 text-orange-400 px-1.5 py-0.2 rounded border border-orange-500/40 font-mono">
                        Hoje
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block mb-2">{day.label}</span>
                </div>

                <div className="pt-2 border-t border-blue-500/10 flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">Atividades:</span>
                  <span className="font-bold text-white">{dayActs.length}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. DUAS COLUNAS: FRENTES EM ANDAMENTO & ATALHOS RÁPIDOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 e 2: Lista de Frentes em Andamento */}
        <div className="lg:col-span-2 bg-[#0c1524] border border-blue-500/20 rounded-lg p-5 shadow-md space-y-4">
          <div className="flex justify-between items-center border-b border-blue-500/15 pb-3">
            <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              Frentes Operacionais Ativas ({inProgressActivities.length})
            </h2>
            <Link
              href="/pintura/atividades"
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
            >
              Ver todas →
            </Link>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 font-mono">
              Carregando frentes operacionais...
            </div>
          ) : inProgressActivities.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              Nenhuma frente de trabalho com status &ldquo;Em Andamento&rdquo; no momento.
            </div>
          ) : (
            <div className="divide-y divide-blue-500/10">
              {inProgressActivities.slice(0, 5).map((act) => (
                <div key={act.id} className="py-3 flex items-center justify-between hover:bg-blue-500/10 px-2 rounded transition-colors">
                  <div className="space-y-0.5 max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-blue-400">{act.orderNumber}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-xs text-slate-400 truncate">{act.location?.area || "Área geral"}</span>
                    </div>
                    <p className="font-medium text-white text-xs truncate">{act.name}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <ActivityStatusBadge status={act.status} />
                    <span className="block text-[11px] font-mono font-bold text-orange-400">
                      {act.progressPercentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coluna 3: Acesso Rápido aos Módulos */}
        <div className="bg-[#0c1524] border border-blue-500/20 rounded-lg p-5 shadow-md space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider border-b border-blue-500/15 pb-3">
              Módulos do Sistema
            </h2>

            <div className="space-y-2">
              <Link
                href="/pintura/materiais-estoque"
                className="p-2.5 rounded-lg border border-blue-500/15 hover:border-blue-500/40 bg-[#070c14] hover:bg-blue-500/10 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">📦</span>
                  <div>
                    <span className="text-xs font-bold text-white block">Materiais & Estoque</span>
                    <span className="text-[11px] text-slate-400">Saldo e projeção</span>
                  </div>
                </div>
                <span className="text-xs text-orange-400 font-bold">→</span>
              </Link>

              <Link
                href="/pintura/chat"
                className="p-2.5 rounded-lg border border-blue-500/15 hover:border-blue-500/40 bg-[#070c14] hover:bg-blue-500/10 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">💬</span>
                  <div>
                    <span className="text-xs font-bold text-white block">Chat da Operação</span>
                    <span className="text-[11px] text-slate-400">Mensagens e fotos</span>
                  </div>
                </div>
                <span className="text-xs text-orange-400 font-bold">→</span>
              </Link>

              <Link
                href="/pintura/ia"
                className="p-2.5 rounded-lg border border-blue-500/15 hover:border-blue-500/40 bg-[#070c14] hover:bg-blue-500/10 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🤖</span>
                  <div>
                    <span className="text-xs font-bold text-white block">Assistente IA</span>
                    <span className="text-[11px] text-slate-400">Consultas técnicas</span>
                  </div>
                </div>
                <span className="text-xs text-orange-400 font-bold">→</span>
              </Link>
            </div>
          </div>

          <div className="pt-3 border-t border-blue-500/10 text-center text-[11px] font-mono text-slate-500">
            RSS3 Soluções Industriais
          </div>
        </div>
      </div>
    </div>
  );
}
