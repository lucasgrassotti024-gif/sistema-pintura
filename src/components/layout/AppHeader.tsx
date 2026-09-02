"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";

export function AppHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { toggleMobileOpen } = useSidebar();

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
    <header className="h-16 bg-[#08101d]/95 backdrop-blur-md border-b border-blue-500/15 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Botão Hamburger (Mobile) + Contexto da Página / Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleMobileOpen}
          title="Abrir menu de navegação"
          className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-blue-500/10 rounded-md border border-blue-500/20 transition-colors shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 shrink-0">
          <span className="text-orange-500 font-bold tracking-wider">RSS3</span>
          <span className="text-blue-400 font-semibold">/</span>
          <span className="text-blue-400 font-semibold">PINTURA</span>
          <span>/</span>
          <span className="text-slate-400 uppercase hidden sm:inline">{context.section}</span>
        </div>
        <span className="hidden sm:inline text-white/20">|</span>
        <h1 className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate">
          {context.title}
        </h1>
      </div>

      {/* Ações Rápidas de Topo & Notificações */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
          <span className="hidden md:inline font-semibold">SISTEMA ONLINE</span>
        </div>

        <Link
          href="/pintura/notificacoes"
          title="Notificações"
          className="p-2 text-slate-400 hover:text-white hover:bg-blue-500/10 rounded-md border border-blue-500/15 transition-colors relative"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
