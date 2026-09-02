"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function AppHeader() {
  const pathname = usePathname();
  const { profile } = useAuth();

  // Mapeamento de rotas para breadcrumb descritivo
  const getBreadcrumbTitle = () => {
    if (pathname === "/pintura") return "Visão Geral";
    if (pathname.includes("/pintura/atividades")) return "Frentes de Trabalho & OS";
    if (pathname.includes("/pintura/programacao")) return "Programação Semanal";
    if (pathname.includes("/pintura/materiais-estoque")) return "Materiais & Estoque";
    if (pathname.includes("/pintura/dashboard")) return "Dashboard Operacional";
    if (pathname.includes("/pintura/historico")) return "Histórico & Auditoria";
    if (pathname.includes("/pintura/chat")) return "Chat da Operação";
    if (pathname.includes("/pintura/ia")) return "Assistente IA";
    if (pathname.includes("/pintura/notificacoes")) return "Central de Notificações";
    return "Pintura Industrial";
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-xs">
      {/* 1. BREADCRUMBS / LOCALIZAÇÃO ATUAL */}
      <div className="flex items-center gap-2 text-xs">
        <Link
          href="/"
          className="text-slate-500 hover:text-blue-600 transition-colors font-medium flex items-center gap-1.5"
          title="Retornar à Seleção de Módulos"
        >
          <span className="font-bold text-blue-700 font-mono tracking-wider">RSS3</span>
          <span className="text-slate-400">/</span>
        </Link>
        <Link
          href="/pintura"
          className="text-slate-600 hover:text-blue-600 transition-colors font-medium"
        >
          Pintura
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 font-bold tracking-tight">
          {getBreadcrumbTitle()}
        </span>
      </div>

      {/* 2. STATUS DO SISTEMA E INFORMAÇÃO DO USUÁRIO */}
      <div className="flex items-center gap-3">
        {/* Indicador de Status Operacional Online */}
        <div className="hidden sm:flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full text-[11px] font-mono text-blue-700">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="font-semibold">Planta Operacional</span>
        </div>

        {/* Perfil Compacto do Usuário */}
        {profile && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-800 text-xs font-bold font-mono">
              {profile.fullName ? profile.fullName.substring(0, 2).toUpperCase() : "OP"}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {profile.fullName}
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-mono">
                {profile.role}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
