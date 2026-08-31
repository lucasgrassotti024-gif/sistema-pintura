"use client";

import React, { useState } from "react";
import { Activity } from "../types/activity.types";

interface ArchiveActivityModalProps {
  activity: Activity;
  onConfirmArchive: (activityId: string, reason?: string) => Promise<void> | void;
  onClose: () => void;
}

export function ArchiveActivityModal({
  activity,
  onConfirmArchive,
  onClose,
}: ArchiveActivityModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Guarda de segurança no frontend: se já estiver arquivada, não executa
  if (activity.archivedAt) {
    return null;
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onConfirmArchive(activity.id, reason.trim() || undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao arquivar atividade no Supabase.";
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-lg p-6 max-w-md w-full space-y-5 shadow-2xl">
        <div className="flex justify-between items-start border-b border-white/5 pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              Ciclo de Vida
            </span>
            <h2 className="text-base font-bold text-slate-100 leading-snug">
              Arquivar Atividade
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 space-y-1 text-xs text-amber-200">
          <p className="font-semibold text-amber-300">
            Você está prestes a arquivar a OS {activity.orderNumber} ({activity.name}).
          </p>
          <p className="text-amber-300/80 text-[11px]">
            A atividade será removida da listagem operacional ativa e da programação semanal. Todos os seus dados, fotos e histórico permanecerão preservados e acessíveis na aba de Arquivadas.
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Motivo do Arquivamento (Opcional)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva opcionalmente a razão para arquivar esta atividade..."
              className="w-full text-xs bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 rounded border border-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 rounded shadow-xs transition-colors"
            >
              {isSubmitting ? "Arquivando..." : "Arquivar atividade"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

