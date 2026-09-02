"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function SelecaoAreaPage() {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between p-4 sm:p-8">
      {/* 1. CABEÇALHO */}
      <header className="flex justify-between items-center max-w-5xl w-full mx-auto pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-mono font-bold text-base shadow-xs">
            R3
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              RSS3 Soluções Industriais
            </h1>
            <p className="text-xs text-blue-600 font-semibold font-mono tracking-wider uppercase">
              Portal Operacional Integrado
            </p>
          </div>
        </div>

        {profile && (
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-800 block">
              {profile.fullName}
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-mono">
              {profile.role}
            </span>
          </div>
        )}
      </header>

      {/* 2. CONTEÚDO PRINCIPAL - SELEÇÃO DE MÓDULOS */}
      <main className="max-w-5xl w-full mx-auto my-auto py-10 space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Selecione a Frente Operacional
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Acesse o módulo de gestão técnica correspondente à sua área de atuação na planta.
          </p>
        </div>

        {/* Grade de Módulos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Card Ativo: Pintura Industrial */}
          <Link
            href="/pintura"
            className="group bg-white border border-slate-200 hover:border-blue-500 rounded-xl p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                  🎨
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-blue-100 text-blue-800 border border-blue-300 uppercase tracking-wider">
                  Módulo Ativo
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  Pintura Industrial
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Ordens de serviço, cronograma de aplicação, planejamento de tintas, consumo real e auditoria técnica.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
              <span>Acessar Gestão de Pintura</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>

          {/* Card Desabilitado / Em Breve */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 opacity-60 flex flex-col justify-between space-y-4 cursor-not-allowed">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center text-2xl">
                  ⚙️
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-slate-200 text-slate-600 uppercase tracking-wider">
                  Em Desenvolvimento
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-700">
                  Manutenção Mecânica & Estrutural
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Inspeção de caldeiraria, tubulações industriais e conformidade técnica de montagem.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 text-xs font-mono text-slate-400">
              Módulo programado para próxima fase
            </div>
          </div>
        </div>
      </main>

      {/* 3. RODAPÉ */}
      <footer className="max-w-5xl w-full mx-auto pt-6 border-t border-slate-200 text-center text-xs text-slate-500 font-mono">
        RSS3 Soluções Industriais • Gestão Técnica Operacional
      </footer>
    </div>
  );
}
