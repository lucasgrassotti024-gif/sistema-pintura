"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useIaChat } from "@/modules/ia/hooks/useIaChat";
import { useActivities } from "@/modules/atividades/hooks/useActivities";
import { useMaterials } from "@/modules/materiais/hooks/useMaterials";
import { isActivityDelayed } from "@/modules/atividades/rules/activity.rules";
import { formatDateISO } from "@/modules/atividades/utils/week.utils";

export default function IAPage() {
  const { messages, isLoading, isInitializing, error, sendMessage, stopGeneration, clearChat } = useIaChat();
  
  const { rawActivities } = useActivities();
  const { materials } = useMaterials();

  const [inputQuery, setInputQuery] = useState("");
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const todayISO = useMemo(() => formatDateISO(new Date()), []);
  const tomorrowISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateISO(d);
  }, []);

  const summary = useMemo(() => {
    const active = rawActivities.filter(
      (a) => a.status === "programada" || a.status === "em_andamento" || a.status === "planejada" || a.status === "pausada"
    );

    const delayed = active.filter((a) => isActivityDelayed(a, todayISO));

    const dueSoon = active.filter(
      (a) =>
        a.schedule.plannedEndDate >= todayISO &&
        a.schedule.plannedEndDate <= tomorrowISO &&
        Number(a.progressPercentage || 0) < 80
    );

    const criticalMaterials = materials.filter(
      (m) => m.active && m.currentStock < m.minimumStock
    );

    return {
      activeCount: active.length,
      delayedCount: delayed.length,
      dueSoonCount: dueSoon.length,
      criticalMaterialsCount: criticalMaterials.length,
    };
  }, [rawActivities, materials, todayISO, tomorrowISO]);

  const dynamicSuggestions = useMemo(() => {
    const list: string[] = [];

    if (summary.delayedCount > 0) {
      list.push("Quais atividades estão atrasadas e quais os responsáveis?");
    }

    if (summary.criticalMaterialsCount > 0) {
      list.push("Quais insumos estão abaixo do estoque mínimo e podem comprometer frentes?");
    }

    if (summary.dueSoonCount > 0) {
      list.push("Existe risco de atraso nas atividades que vencem amanhã?");
    }

    if (summary.activeCount > 0) {
      list.push("Faça um resumo executivo da operação de pintura hoje.");
    }

    if (list.length < 4) {
      list.push("Qual atividade em andamento apresenta maior criticidade?");
    }

    return list.slice(0, 4);
  }, [summary]);

  const handleSend = (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || isLoading) return;
    sendMessage(query);
    setInputQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 max-w-5xl mx-auto flex flex-col h-[calc(100dvh-7rem)] sm:h-[calc(100vh-6.5rem)]">
      {/* 1. CABEÇALHO TÉCNICO */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
              Inteligência Operacional RSS3
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
              Read-Only • Gemini 3.6 Flash
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Assistente técnico da operação de pintura para análises de ordens de serviço, cronograma e insumos.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={clearChat}
            disabled={isLoading || messages.length <= 1}
            className="text-xs font-semibold px-3 py-1.5 bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-highlight)] disabled:opacity-30 text-[var(--text-secondary)] rounded-md border border-[var(--border-medium)] transition-colors cursor-pointer"
          >
            Limpar Conversa
          </button>
        </div>
      </div>

      {/* 2. SUGESTÕES RÁPIDAS */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3.5 sm:px-4 py-2.5 space-y-2 shadow-sm shrink-0">
        <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          Sugestões de Consulta Operacional:
        </span>
        <div className="flex flex-wrap gap-2 max-h-24 sm:max-h-none overflow-y-auto">
          {dynamicSuggestions.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={isLoading}
              className="text-xs bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-highlight)] border border-[var(--border-medium)] hover:border-blue-500/40 disabled:opacity-50 px-3 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-left font-medium cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* 3. JANELA DE CONVERSA PRINCIPAL */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-md flex flex-col flex-1 min-h-[250px] sm:min-h-[420px] overflow-hidden">
        <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto space-y-4 bg-[var(--bg-base)]">
          {isInitializing ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] font-mono py-12">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping mr-2" />
              Recuperando histórico da conversa...
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                {/* Identificador */}
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                    msg.sender === "user" ? "text-orange-500" : "text-blue-600 dark:text-blue-400 flex items-center gap-1"
                  }`}>
                    {msg.sender === "user" ? "[Você]" : "● Assistente Operacional RSS3"}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">{msg.timestamp}</span>
                </div>

                {/* Bolha de Mensagem */}
                <div
                  className={`max-w-[95%] sm:max-w-[85%] rounded-lg p-3.5 sm:p-4 text-xs leading-relaxed border break-words overflow-x-auto ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                      : "bg-[var(--bg-surface)] border-[var(--border-medium)] text-[var(--text-primary)] shadow-sm"
                  }`}
                >
                  {msg.text ? (
                    <div className="whitespace-pre-wrap font-sans space-y-2">
                      {msg.text}
                      {msg.isStreaming && (
                        <span className="inline-block w-2 h-3.5 ml-1 bg-orange-500 animate-pulse align-middle" />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[var(--text-muted)] font-mono py-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                      Consultando dados operacionais da planta...
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          <div ref={chatBottomRef} />
        </div>

        {error && (
          <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/30 text-xs text-rose-600 dark:text-rose-300 flex items-center justify-between shrink-0 font-mono">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => clearChat()}
              className="text-[11px] underline hover:opacity-80 font-mono cursor-pointer"
            >
              Reiniciar
            </button>
          </div>
        )}

        {/* Barra Inferior de Entrada */}
        <div className="p-3 sm:p-3.5 bg-[var(--bg-surface-raised)] border-t border-[var(--border-subtle)] flex items-end gap-2 shrink-0">
          <textarea
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Pergunte sobre atividades, prazos, estoque ou uma OS..."
            rows={2}
            className="flex-1 bg-[var(--bg-input)] border border-[var(--border-medium)] focus:border-blue-500 dark:focus:border-orange-500 rounded-lg p-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-hidden resize-none transition-colors shadow-xs"
          />

          {isLoading ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="px-3.5 sm:px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shrink-0 cursor-pointer"
            >
              Parar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!inputQuery.trim()}
              className="px-3.5 sm:px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors shadow-md shrink-0 active:scale-95 cursor-pointer"
            >
              Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
