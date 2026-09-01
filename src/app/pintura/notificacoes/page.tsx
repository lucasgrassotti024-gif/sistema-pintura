"use client";

import React from "react";
import Link from "next/link";
import { useNotifications } from "@/modules/notificacoes/hooks/useNotifications";
import { NotificationSeverity, NotificationCategory } from "@/modules/notificacoes/types/notification.types";

export default function NotificacoesPage() {
  const {
    filteredNotifications,
    unreadCount,
    isLoading,
    error,
    readFilter,
    setReadFilter,
    categoryFilter,
    setCategoryFilter,
    refreshNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
  } = useNotifications();

  const getSeverityBadge = (sev: NotificationSeverity) => {
    switch (sev) {
      case "urgente":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-[#090d16] text-rose-400 border border-rose-500/30 rounded uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Urgente
          </span>
        );
      case "alerta":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-[#090d16] text-amber-400 border border-amber-500/30 rounded uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Alerta
          </span>
        );
      case "info":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-[#090d16] text-emerald-400 border border-emerald-500/30 rounded uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Informativo
          </span>
        );
    }
  };

  const getCategoryBadge = (cat: NotificationCategory) => {
    switch (cat) {
      case "atividades":
        return <span className="text-[10px] font-mono text-slate-400 uppercase">Atividades</span>;
      case "estoque":
        return <span className="text-[10px] font-mono text-slate-400 uppercase">Estoque</span>;
      case "sistema":
        return <span className="text-[10px] font-mono text-slate-400 uppercase">Sistema</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. CABEÇALHO (Dark Premium Industrial) */}
      <div className="bg-[#0f172a] border border-white/10 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Central de Notificações
            </h1>
            {unreadCount > 0 && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Registro de ocorrências operacionais reais, prazos e alertas de insumos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0 || isLoading}
            className="text-xs font-semibold px-3 py-1.5 bg-[#090d16] hover:bg-white/5 disabled:opacity-40 text-slate-200 rounded border border-white/10 hover:border-white/20 transition-colors"
          >
            Marcar todas como lidas
          </button>
          <button
            type="button"
            onClick={refreshNotifications}
            title="Atualizar lista"
            className="p-1.5 bg-[#090d16] hover:bg-white/5 text-slate-400 hover:text-slate-200 rounded border border-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Diagnóstico de Erro Real (se houver) */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* 2. FILTROS (Abas de Leitura e Categoria) */}
      <div className="bg-[#0f172a] border border-white/10 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
        {/* Filtro de Leitura */}
        <div className="flex items-center gap-1.5 bg-[#090d16] p-1 rounded border border-white/10 flex-wrap">
          <button
            type="button"
            onClick={() => setReadFilter("todas")}
            className={`px-3 py-1 font-semibold rounded transition-colors ${
              readFilter === "todas"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setReadFilter("nao_lidas")}
            className={`px-3 py-1 font-semibold rounded transition-colors ${
              readFilter === "nao_lidas"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Não Lidas ({unreadCount})
          </button>
        </div>

        {/* Filtro por Categoria */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-mono text-[11px]">Categoria:</span>
          <div className="flex items-center gap-1 bg-[#090d16] p-1 rounded border border-white/10 flex-wrap">
            <button
              type="button"
              onClick={() => setCategoryFilter("todas")}
              className={`px-2.5 py-1 font-medium rounded transition-colors ${
                categoryFilter === "todas"
                  ? "bg-white/10 text-slate-100 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("atividades")}
              className={`px-2.5 py-1 font-medium rounded transition-colors ${
                categoryFilter === "atividades"
                  ? "bg-white/10 text-slate-100 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Atividades
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("estoque")}
              className={`px-2.5 py-1 font-medium rounded transition-colors ${
                categoryFilter === "estoque"
                  ? "bg-white/10 text-slate-100 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Estoque
            </button>
          </div>
        </div>
      </div>

      {/* 3. LISTA DE NOTIFICAÇÕES REAIS */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-[#0f172a] border border-white/10 rounded-lg font-mono">
            Carregando e sincronizando ocorrências do sistema...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-[#0f172a] border border-white/10 rounded-lg font-mono">
            Nenhuma notificação encontrada para este filtro.
          </div>
        ) : (
          filteredNotifications.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-lg border transition-all ${
                item.read
                  ? "bg-[#0f172a] border-white/5 opacity-85"
                  : "bg-[#0f172a] border-emerald-500/30 shadow-[0_0_12px_-2px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20"
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getSeverityBadge(item.severity)}
                    {getCategoryBadge(item.category)}
                    {!item.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 leading-snug">{item.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed pt-0.5">{item.message}</p>
                </div>
                <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                  {new Date(item.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Ações da Notificação */}
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs">
                {item.linkHref ? (
                  <Link
                    href={item.linkHref}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
                  >
                    Ver detalhes no módulo →
                  </Link>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  onClick={() => (item.read ? markAsUnread(item.id) : markAsRead(item.id))}
                  className="text-slate-400 hover:text-slate-200 font-mono text-[11px] transition-colors"
                >
                  {item.read ? "Marcar como não lida" : "Marcar como lida"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
