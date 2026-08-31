"use client";

import React, { useState } from "react";
import { Activity } from "../types/activity.types";

interface PermanentDeleteActivityModalProps {
  activity: Activity;
  onConfirmDelete: (activityId: string) => Promise<void> | void;
  onClose: () => void;
}

export function PermanentDeleteActivityModal({
  activity,
  onConfirmDelete,
  onClose,
}: PermanentDeleteActivityModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await onConfirmDelete(activity.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir atividade definitivamente.";
      setError(msg);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-rose-500/30 rounded-lg p-6 max-w-md w-full space-y-5 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex justify-between items-start border-b border-rose-500/20 pb-3">
          <div>
            <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-wider">
              Ação Destrutiva Irreversível
            </span>
            <h2 className="text-base font-bold text-slate-100 leading-snug mt-0.5">
              Excluir Atividade Definitivamente?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Mensagem de Erro Real (se houver) */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Corpo Informativo */}
        <div className="space-y-3 text-xs text-slate-300">
          <p className="leading-relaxed">
            Esta ação removerá permanentemente esta atividade, seus apontamentos de consumo, registros de auditoria, fotos e notificações associadas.
          </p>

          <div className="bg-[#090d16] border border-white/10 rounded p-3 space-y-1">
            <div className="flex justify-between">
              <span className="font-mono text-slate-400">OS:</span>
              <span className="font-mono font-bold text-emerald-400">{activity.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-slate-400">Atividade:</span>
              <span className="font-semibold text-slate-100 truncate max-w-[220px]">{activity.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-slate-400">Área:</span>
              <span className="text-slate-300">{activity.location?.area || "Geral"}</span>
            </div>
          </div>

          <p className="text-rose-400 font-mono text-[11px] font-bold">
            ⚠ Esta operação não poderá ser desfeita.
          </p>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs font-semibold px-3 py-2 bg-[#090d16] hover:bg-white/5 text-slate-300 rounded border border-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="text-xs font-bold px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded transition-colors shadow-[0_0_12px_-2px_rgba(244,63,94,0.4)]"
          >
            {isDeleting ? "Excluindo..." : "Confirmar Exclusão Definitiva"}
          </button>
        </div>
      </div>
    </div>
  );
}
