"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/context/AuthContext";

export function HeaderNavigation() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const navItems = [
    { label: "Visão Geral", href: "/pintura" },
    { label: "Atividades", href: "/pintura/atividades" },
    { label: "Histórico", href: "/pintura/historico" },
    { label: "Programação", href: "/pintura/programacao" },
    { label: "Materiais & Estoque", href: "/pintura/materiais-estoque" },
    { label: "Assistente IA", href: "/pintura/ia" },
    { label: "Dashboard", href: "/pintura/dashboard" },
    { label: "Notificações", href: "/pintura/notificacoes" },
  ];

  const isAreasPage = pathname === "/";

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Identificação */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                SP
              </span>
              <span className="font-bold text-slate-900 text-sm sm:text-base">
                Sistema Operacional
              </span>
            </Link>

            {/* Badge de Área Atual */}
            {!isAreasPage && (
              <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-slate-200">
                <span className="text-xs text-slate-400 font-medium">Área:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Pintura
                </span>
                <Link
                  href="/"
                  className="text-xs text-slate-500 hover:text-slate-800 underline ml-1"
                >
                  (Trocar)
                </Link>
              </div>
            )}
          </div>

          {/* Links de Navegação */}
          {!isAreasPage && (
            <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Navegação Mobile / Ação Rápida / Usuário Logado / Botão de Tema */}
          <div className="flex items-center gap-2">
            {!isAreasPage && (
              <Link
                href="/pintura/notificacoes"
                className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1.5 bg-slate-100 rounded border border-slate-200 hidden sm:inline-block"
              >
                Notificações
              </Link>
            )}

            {/* Usuário Logado & Botão Sair */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <span className="text-[11px] font-medium text-slate-600 truncate max-w-[130px] hidden md:inline" title={user.email}>
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  title="Encerrar sessão"
                  className="text-xs font-semibold px-2 py-1 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors"
                >
                  Sair
                </button>
              </div>
            )}

            <ThemeToggle />
          </div>
        </div>

        {/* Menu Secundário em Telas Menores */}
        {!isAreasPage && (
          <div className="md:hidden flex items-center gap-2 py-2 border-t border-slate-100 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
