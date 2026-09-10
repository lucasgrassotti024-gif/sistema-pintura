"use client";

import React, { useEffect } from "react";

export default function IaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[IaError] Erro capturado na rota /pintura/ia:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center max-w-xl mx-auto space-y-4">
      <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 text-xl font-bold">
        ⚠️
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          Falha no Carregamento da IA Operacional
        </h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Ocorreu uma instabilidade na renderização do módulo de Inteligência Artificial.
        </p>
      </div>

      {error?.message && (
        <div className="w-full text-left p-3 rounded-lg bg-[var(--bg-surface-raised)] border border-rose-500/20 text-rose-400 font-mono text-[11px] overflow-x-auto max-h-32">
          {error.message}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Tentar Novamente
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-highlight)] text-[var(--text-primary)] border border-[var(--border-medium)] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Recarregar Página
        </button>
      </div>
    </div>
  );
}
