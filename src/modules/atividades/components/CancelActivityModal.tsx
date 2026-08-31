"use client";

import React, { useState } from "react";
import { Activity } from "../types/activity.types";
import { cancelActivity } from "../services/activity.service";

interface CancelActivityModalProps {
  activity: Activity;
  onConfirmCancel: (updatedActivity: Activity) => void;
  onClose: () => void;
}

export function CancelActivityModal({ activity, onConfirmCancel, onClose }: CancelActivityModalProps) {
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!justification.trim()) {
      setError("A justificativa de cancelamento é obrigatória.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await cancelActivity(activity.id, justification.trim());
      onConfirmCancel(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao cancelar atividade no banco.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md w-full space-y-5 shadow-xl">
        <div className="flex justify-between items-start border-b border-red-100 pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-red-600 uppercase">Atenção</span>
            <h2 className="text-base font-bold text-slate-900 leading-snug">Cancelar Atividade</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xs px-2 py-1 bg-slate-100 rounded"
          >
            Fechar
          </button>
        </div>

        <div className="bg-red-50/70 p-3.5 rounded-lg border border-red-200 text-xs text-red-800 space-y-1">
          <p className="font-bold">Confirmação de Cancelamento:</p>
          <p>
            Você está cancelando a atividade <strong>{activity.orderNumber} - {activity.name}</strong>.
          </p>
          <p className="text-[11px] text-red-700 mt-1">
            * A atividade será preservada com todo o histórico e consumos registrados, sem exclusão física dos dados.
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-red-100 text-red-800 border border-red-300 rounded-md font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Justificativa Obrigatória *
            </label>
            <textarea
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Descreva o motivo do cancelamento da ordem de serviço..."
              className="w-full text-xs border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-red-500 focus:outline-hidden"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-300"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded shadow-xs transition-colors"
            >
              {isSubmitting ? "Cancelando..." : "Confirmar Cancelamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
