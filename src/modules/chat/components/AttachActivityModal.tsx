"use client";

import React, { useState, useMemo } from "react";
import { Activity } from "@/modules/atividades/types/activity.types";
import { useActivities } from "@/modules/atividades/hooks/useActivities";
import { ActivityStatusBadge } from "@/modules/atividades/components/ActivityStatusBadge";

interface AttachActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (activity: Activity) => void;
}

export function AttachActivityModal({ isOpen, onClose, onSelect }: AttachActivityModalProps) {
  const { rawActivities, isLoading } = useActivities();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredActivities = useMemo(() => {
    return rawActivities
      .filter((act) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const matchesNota = act.orderNumber.toLowerCase().includes(term);
        const matchesName = act.name.toLowerCase().includes(term);
        const matchesArea = act.location?.area?.toLowerCase().includes(term) ?? false;
        const matchesResp = act.assignedTo?.toLowerCase().includes(term) ?? false;
        return matchesNota || matchesName || matchesArea || matchesResp;
      })
      .slice(0, 15); // Limita para exibição rápida e fluida
  }, [rawActivities, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-xl max-w-xl w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden transition-colors duration-200">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase font-mono tracking-wider">
              Anexar Ordem de Serviço à Conversa
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-highlight)] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Campo de Busca */}
        <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔎 Buscar por OS (ex: OS-1002), nome, área ou responsável..."
            className="w-full bg-[var(--bg-input)] border border-[var(--border-medium)] focus:border-blue-500 dark:focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-hidden shadow-xs"
            autoFocus
          />
        </div>

        {/* Lista de Atividades Selecionáveis */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[var(--bg-surface)]">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] font-mono">
              Carregando atividades operacionais...
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] font-mono">
              Nenhuma atividade encontrada com o termo pesquisado.
            </div>
          ) : (
            filteredActivities.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => {
                  onSelect(act);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-lg bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-highlight)] border border-[var(--border-subtle)] hover:border-blue-500/40 transition-all flex flex-col gap-1.5 group cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-emerald-400 group-hover:text-blue-700 dark:group-hover:text-emerald-300">
                      {act.orderNumber}
                    </span>
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[280px]">
                      {act.name}
                    </span>
                  </div>
                  <ActivityStatusBadge status={act.status} />
                </div>

                <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] font-mono">
                  <span>Progresso: {act.progressPercentage}%</span>
                  <span>•</span>
                  <span>Área: {act.location?.area || "—"}</span>
                  <span>•</span>
                  <span>Término: {act.schedule.plannedEndDate}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Rodapé */}
        <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-highlight)] rounded border border-[var(--border-medium)] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
