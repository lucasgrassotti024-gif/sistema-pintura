"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Visão Geral", href: "/pintura", icon: "📊" },
  { label: "Atividades & OS", href: "/pintura/atividades", icon: "📋" },
  { label: "Programação Semanal", href: "/pintura/programacao", icon: "📅" },
  { label: "Materiais & Estoque", href: "/pintura/materiais-estoque", icon: "📦" },
  { label: "Dashboard", href: "/pintura/dashboard", icon: "📈" },
  { label: "Histórico & Arquivo", href: "/pintura/historico", icon: "📑" },
  { label: "Chat Operacional", href: "/pintura/chat", icon: "💬" },
  { label: "Assistente IA", href: "/pintura/ia", icon: "🤖" },
  { label: "Notificações", href: "/pintura/notificacoes", icon: "🔔" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const isActive = (href: string) => {
    if (href === "/pintura") {
      return pathname === "/pintura";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Botão Hambúrguer Mobile */}
      <button
        type="button"
        onClick={() => setIsOpenMobile(!isOpenMobile)}
        className="md:hidden fixed top-3 left-4 z-50 p-2 rounded-lg bg-white border border-slate-200 text-slate-800 shadow-md transition-colors"
        aria-label="Abrir Menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay Mobile */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Sidebar Lateral */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 border-r flex flex-col transition-colors duration-200 ease-in-out md:translate-x-0 shadow-sm ${
          theme === "light"
            ? "bg-[#e9eef5] border-[#cbd5e1]"
            : "bg-[#0f172a] border-[#1e293b]"
        } ${isOpenMobile ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Topo / Logotipo do Sistema RSS3 & Alternador de Tema */}
        <div
          className={`h-16 px-4 flex items-center justify-between border-b transition-colors duration-200 ${
            theme === "light"
              ? "bg-[#dde5f0] border-[#cbd5e1]"
              : "bg-[#0b1120] border-[#1e293b]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-orange-500 flex items-center justify-center text-white font-mono font-bold text-sm shadow-xs">
              R3
            </div>
            <div className="flex flex-col">
              <span
                className={`text-xs font-mono font-bold tracking-widest leading-none ${
                  theme === "light" ? "text-[#0f172a]" : "text-white"
                }`}
              >
                RSS3
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium tracking-tight mt-0.5">
                Soluções Industriais
              </span>
            </div>
          </div>

          {/* Botão de Alternância de Tema Claro / Escuro */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono font-semibold transition-all border shadow-xs cursor-pointer active:scale-95 ${
              theme === "light"
                ? "border-[#cbd5e1] bg-[#eef2f7] hover:bg-[#e2e8f0] text-[#1e293b]"
                : "border-blue-500/20 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            {theme === "dark" ? (
              <>
                <span className="text-amber-400 text-sm">☀️</span>
                <span className="text-[10px] text-slate-300 hidden sm:inline">Claro</span>
              </>
            ) : (
              <>
                <span className="text-blue-600 text-sm">🌙</span>
                <span className="text-[10px] text-slate-700 hidden sm:inline">Escuro</span>
              </>
            )}
          </button>
        </div>

        {/* Links de Navegação */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpenMobile(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs transition-all group relative ${
                  active
                    ? "bg-[#2563eb] text-white font-semibold border border-[#1d4ed8] shadow-xs"
                    : theme === "light"
                    ? "text-[#475569] font-medium hover:text-[#0f172a] hover:bg-[#dbe4f0]"
                    : "text-[#94a3b8] font-medium hover:text-white hover:bg-slate-800/60"
                }`}
              >
                {/* Indicador lateral do item ativo em Laranja RSS3 */}
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-orange-500 rounded-r shadow-xs" />
                )}

                <span className="text-sm shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar: Informações de Sessão & Logout */}
        <div
          className={`p-3 border-t transition-colors duration-200 ${
            theme === "light"
              ? "bg-[#dde5f0] border-[#cbd5e1]"
              : "bg-[#0b1120] border-[#1e293b]"
          }`}
        >
          <div
            className={`flex items-center justify-between p-2.5 rounded-lg border shadow-xs ${
              theme === "light"
                ? "bg-[#eef2f7] border-[#cbd5e1]"
                : "bg-[#0b1120] border-[#1e293b]"
            }`}
          >
            <div className="flex flex-col min-w-0 pr-2">
              <span
                className={`text-xs font-semibold truncate ${
                  theme === "light" ? "text-[#0f172a]" : "text-white"
                }`}
              >
                {profile?.fullName || "Operador"}
              </span>
              <span
                className={`text-[10px] uppercase font-mono ${
                  theme === "light" ? "text-[#64748b]" : "text-slate-400"
                }`}
              >
                {profile?.role || "Acesso"}
              </span>
            </div>
            <button
              type="button"
              onClick={signOut}
              title="Encerrar Sessão"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                theme === "light"
                  ? "text-[#64748b] hover:text-rose-600 hover:bg-rose-50"
                  : "text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
