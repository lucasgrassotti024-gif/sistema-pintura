"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function AppHeader() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Título e migalhas de pão baseados na rota
  const getPageContext = () => {
    switch (pathname) {
      case "/pintura/atividades":
        return { section: "OPERAÇÃO", title: "Atividades & Ordens de Serviço" };
      case "/pintura/programacao":
        return { section: "OPERAÇÃO", title: "Programação Semanal" };
      case "/pintura/historico":
        return { section: "OPERAÇÃO", title: "Histórico & Auditoria" };
      case "/pintura/materiais-estoque":
        return { section: "OPERAÇÃO", title: "Materiais & Estoque Técnico" };
      case "/pintura/dashboard":
        return { section: "PRINCIPAL", title: "Dashboard Executivo" };
      case "/pintura/chat":
        return { section: "OPERAÇÃO", title: "Chat da Operação" };
      case "/pintura/ia":
        return { section: "INTELIGÊNCIA", title: "Assistente Operacional IA" };
      case "/pintura/notificacoes":
        return { section: "SISTEMA", title: "Notificações & Alertas" };
      default:
        return { section: "SISTEMA", title: "Visão Geral" };
    }
  };

  const context = getPageContext();

  return (
    <header className="h-16 bg-[#0c121e]/80 backdrop-blur-md border-b border-white/5 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Contexto da Página / Breadcrumb Industrial */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="text-emerald-400 font-bold">PINTURA</span>
          <span>/</span>
          <span className="text-slate-400 uppercase">{context.section}</span>
        </div>
        <span className="hidden sm:inline text-white/20">|</span>
        <h1 className="hidden sm:inline text-sm font-semibold text-slate-100 tracking-tight">
          {context.title}
        </h1>
      </div>

      {/* Ações Rápidas de Topo & Notificações */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="hidden md:inline">SISTEMA ONLINE</span>
        </div>

        <Link
          href="/pintura/notificacoes"
          title="Notificações"
          className="p-2 text-slate-400 hover:text-slate-100 hover:bg-white/5 rounded-md border border-white/5 transition-colors relative"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
