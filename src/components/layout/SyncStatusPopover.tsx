"use client";

import React, { useState } from "react";
import { useSyncStatus, NormalizedSyncVisualState } from "@/lib/offline";

interface SyncStatusPopoverProps {
  onClose?: () => void;
}

export function SyncStatusPopover({ onClose }: SyncStatusPopoverProps) {
  const {
    isOnline,
    state,
    visualState,
    pendingCount,
    conflictCount,
    failedCount,
    totalCount,
    processedCount,
    currentMutation,
    lastError,
    lastSyncTime,
    triggerSync,
  } = useSyncStatus();

  const [isSyncingManually, setIsSyncingManually] = useState(false);

  const handleManualSync = async () => {
    if (!isOnline || isSyncingManually || state === "syncing") return;
    setIsSyncingManually(true);
    try {
      await triggerSync();
    } finally {
      setIsSyncingManually(false);
    }
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return "Não disponível";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  // Mapeamento semântico do estado de erro/conflito
  const getConflictSummary = () => {
    if (conflictCount === 0 && !lastError) return null;
    const code = lastError?.code || "CONFLICT";
    let desc = "Conflito detectado com os dados do servidor.";
    if (code === "INSUFFICIENT_STOCK") desc = "Estoque insuficiente no servidor para consumo apontado.";
    else if (code === "ACTIVITY_CANCELLED") desc = "A atividade foi cancelada remotamente no servidor.";
    else if (code === "VERSION_MISMATCH" || code === "CONCURRENT_MODIFICATION") desc = "Conflito de versão (alteração simultânea por outro usuário).";
    else if (code === "PROGRESS_LESS_THAN_CURRENT") desc = "Progresso informado é inferior ao registrado no servidor.";
    return { code, desc };
  };

  const conflictInfo = getConflictSummary();

  return (
    <div
      role="dialog"
      aria-label="Painel de Status de Sincronização"
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#0c1322] border border-blue-500/20 rounded-xl shadow-2xl p-4 text-slate-200 z-50 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Sincronização Offline-First
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de sincronização"
            className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Cartão de Estado Atual */}
      <div className="bg-[#070c14] border border-white/5 rounded-lg p-3 space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Status de Rede</span>
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-amber-400"
              }`}
            />
            <span className={isOnline ? "text-emerald-400" : "text-amber-400"}>
              {isOnline ? "Online" : "Offline (Sem conexão)"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Motor de Sincronização</span>
          <span className="text-xs font-mono font-medium text-slate-300">
            {state === "syncing"
              ? "Sincronizando..."
              : state === "error"
              ? "Atenção necessária"
              : state === "paused"
              ? "Pausado"
              : "Pronto (Idle)"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Última Sincronização</span>
          <span className="text-xs font-mono text-slate-300">{formatTime(lastSyncTime)}</span>
        </div>
      </div>

      {/* Métricas e Fila da Outbox */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-[#070c14] border border-white/5 rounded p-2">
          <div className="text-[10px] uppercase font-mono text-slate-400">Pendentes</div>
          <div className={`text-base font-mono font-bold ${pendingCount > 0 ? "text-amber-400" : "text-slate-200"}`}>
            {pendingCount}
          </div>
        </div>

        <div className="bg-[#070c14] border border-white/5 rounded p-2">
          <div className="text-[10px] uppercase font-mono text-slate-400">Conflitos</div>
          <div className={`text-base font-mono font-bold ${conflictCount > 0 ? "text-rose-400" : "text-slate-200"}`}>
            {conflictCount}
          </div>
        </div>

        <div className="bg-[#070c14] border border-white/5 rounded p-2">
          <div className="text-[10px] uppercase font-mono text-slate-400">Falhas</div>
          <div className={`text-base font-mono font-bold ${failedCount > 0 ? "text-rose-400" : "text-slate-200"}`}>
            {failedCount}
          </div>
        </div>
      </div>

      {/* Indicador de Progresso Ativo */}
      {state === "syncing" && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-2.5 mb-3 space-y-1.5" role="status" aria-live="polite">
          <div className="flex justify-between items-center text-xs font-mono text-sky-300">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Enviando alterações...
            </span>
            <span>
              {processedCount}/{totalCount || pendingCount}
            </span>
          </div>
          {currentMutation && (
            <div className="text-[11px] text-slate-400 font-mono truncate">
              Operação: {currentMutation.operation} ({currentMutation.entityType})
            </div>
          )}
        </div>
      )}

      {/* Alerta de Conflito */}
      {conflictInfo && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 mb-3 text-xs space-y-1" role="alert">
          <div className="font-bold text-rose-400 font-mono flex items-center gap-1.5">
            <span>⚠</span>
            <span>Conflito: {conflictInfo.code}</span>
          </div>
          <p className="text-rose-300 text-[11px] leading-relaxed">{conflictInfo.desc}</p>
        </div>
      )}

      {/* Mensagem quando Offline */}
      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mb-3 text-xs text-amber-300/90 leading-relaxed">
          <span>Modo Offline ativo. Novas alterações serão salvas localmente e sincronizadas automaticamente quando a conexão retornar.</span>
        </div>
      )}

      {/* Ação de Sincronização Manual */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 font-mono">
          {pendingCount === 0 ? "Fila vazia" : `${pendingCount} item(s) aguardando`}
        </span>
        <button
          type="button"
          onClick={handleManualSync}
          disabled={!isOnline || state === "syncing" || isSyncingManually || pendingCount === 0}
          aria-label="Sincronizar agora manualmente"
          className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-xs font-mono font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          {state === "syncing" || isSyncingManually ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Sincronizando</span>
            </>
          ) : (
            <>
              <span>↻</span>
              <span>Sincronizar agora</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
