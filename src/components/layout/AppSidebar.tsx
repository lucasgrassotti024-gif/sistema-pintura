"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";

export function AppSidebar() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const { isMobileOpen, closeMobile, isCollapsed, toggleCollapsed } = useSidebar();

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
          label: "Histórico & Auditoria",
          href: "/pintura/historico",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    <>
      {/* Backdrop com Blur no Mobile (< 768px) */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          aria-hidden="true"
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 animate-in fade-in"
        />
      )}

      {/* Sidebar / Off-Canvas Drawer */}
      <aside
        className={`fixed md:sticky top-0 inset-y-0 left-0 h-screen bg-[#08101d] border-r border-blue-500/15 flex flex-col justify-between transition-all duration-300 z-50 md:z-30 shrink-0 select-none ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${isCollapsed ? "md:w-16 w-64" : "w-64"}`}
      >
        {/* Topo: Logo RSS3 & Botão de Fechar no Mobile / Recolher no Desktop */}
        <div>
          <div className="h-16 flex items-center justify-between px-4 border-b border-blue-500/15">
            <Link
              href="/pintura"
              onClick={closeMobile}
              className="flex items-center gap-3 overflow-hidden"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/40 flex items-center justify-center text-orange-500 font-extrabold text-xs tracking-wider shrink-0 shadow-[0_0_12px_-2px_rgba(249,115,22,0.4)]">
                RSS3
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <div className="flex flex-col">
                  <span className="font-bold text-white text-xs tracking-wide">
                    SOLUÇÕES INDUSTRIAIS
                  </span>
                  <span className="text-[10px] text-blue-400 font-mono tracking-wider uppercase">
                    Pintura Industrial
                  </span>
                </div>
              )}
            </Link>

            {/* Botão no Desktop: Recolher/Expandir */}
            <button
              type="button"
              onClick={toggleCollapsed}
              title={isCollapsed ? "Expandir menu" : "Recolher menu"}
              className="hidden md:flex p-1 rounded-md text-slate-400 hover:text-white hover:bg-blue-500/10 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>

            {/* Botão no Mobile: Fechar Gaveta */}
            <button
              type="button"
              onClick={closeMobile}
              title="Fechar menu"
              className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-blue-500/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Lista de Navegação Agrupada */}
          <nav className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-8rem)]">
            {menuGroups.map((group) => (
              <div key={group.category} className="space-y-1">
                {(!isCollapsed || isMobileOpen) && (
                  <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-slate-400 font-mono">
                    {group.category}
                  </div>
                )}
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobile}
                      title={isCollapsed && !isMobileOpen ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-all duration-150 relative group ${
                        isActive
                          ? "bg-orange-500/15 text-orange-400 border border-orange-500/30 shadow-[0_0_15px_-4px_rgba(249,115,22,0.3)] font-semibold"
                          : "text-slate-300 hover:text-white hover:bg-blue-500/10 border border-transparent"
                      } ${isCollapsed && !isMobileOpen ? "justify-center px-0" : ""}`}
                    >
                      {/* Indicador sutil de página ativa em Laranja RSS3 */}
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-orange-500 rounded-r shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                      )}
                      <span className={isActive ? "text-orange-400" : "text-slate-400 group-hover:text-blue-300"}>
                        {item.icon}
                      </span>
                      {(!isCollapsed || isMobileOpen) && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Rodapé da Sidebar: Perfil & Sair */}
        <div className="p-3 border-t border-blue-500/15 bg-[#070c14]/80">
          <div className={`flex items-center ${isCollapsed && !isMobileOpen ? "justify-center" : "justify-between"} gap-2`}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-[#131f33] border border-blue-500/30 flex items-center justify-center text-blue-300 text-xs font-bold shrink-0">
                {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-white truncate leading-tight">
                    {profile?.fullName || user?.email?.split("@")[0] || "Operador"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono uppercase truncate">
                    {profile?.role || "Acesso"}
                  </span>
                </div>
              )}
            </div>

            {(!isCollapsed || isMobileOpen) && (
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
    </>
  );
}
