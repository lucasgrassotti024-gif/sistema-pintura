"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function AppSidebar() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Mapeamento estrito das rotas reais do projeto
  const menuGroups = [
    {
      category: "PRINCIPAL",
      items: [
        {
          label: "Dashboard",
          href: "/pintura/dashboard",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
        {
          label: "Visão Geral",
          href: "/pintura",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          ),
        },
      ],
    },
    {
      category: "OPERAÇÃO",
      items: [
        {
          label: "Atividades",
          href: "/pintura/atividades",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          ),
        },
        {
          label: "Programação",
          href: "/pintura/programacao",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          label: "Materiais & Estoque",
          href: "/pintura/materiais-estoque",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
        },
        {
          label: "Chat da Operação",
          href: "/pintura/chat",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        },
        {
          label: "IA",
          href: "/pintura/ia",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <aside
      className={`bg-[#0c121e] border-r border-white/5 flex flex-col justify-between transition-all duration-300 z-30 shrink-0 select-none ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Topo: Logo & Botão de Recolher */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
          <Link href="/pintura" className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs tracking-wider shrink-0 shadow-[0_0_12px_-2px_rgba(16,185,129,0.3)]">
              SP
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-slate-100 text-xs tracking-wide">
                  SISTEMA PINTURA
                </span>
                <span className="text-[10px] text-emerald-400 font-mono tracking-wider uppercase">
                  Industrial Pro
                </span>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Lista de Navegação Agrupada */}
        <nav className="p-3 space-y-6 overflow-y-auto">
          {menuGroups.map((group) => (
            <div key={group.category} className="space-y-1">
              {!collapsed && (
                <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-slate-500 font-mono">
                  {group.category}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 relative group ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_-4px_rgba(16,185,129,0.3)] font-semibold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                  >
                    {/* Indicador sutil de página ativa */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-emerald-500 rounded-r shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    )}
                    <span className={isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-200"}>
                      {item.icon}
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Rodapé da Sidebar: Perfil & Sair */}
      <div className="p-3 border-t border-white/5 bg-[#090d16]/50">
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 text-xs font-bold shrink-0">
              {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-slate-200 truncate leading-tight">
                  {profile?.fullName || user?.email?.split("@")[0] || "Operador"}
                </span>
                <span className="text-[10px] text-slate-400 font-mono uppercase truncate">
                  {profile?.role || "Acesso"}
                </span>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={signOut}
              title="Encerrar sessão"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
