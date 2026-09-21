"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSyncStatus } from "@/lib/offline";
import { SyncStatusPopover } from "./SyncStatusPopover";

export function SyncStatusBadge() {
  const {
    isOnline,
    visualState,
    pendingCount,
    conflictCount,
    failedCount,
    lastSyncTime,
  } = useSyncStatus();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o popover ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Formata hora do último sync para exibição textual discreta
  const lastSyncShort = (() => {
    if (!lastSyncTime) return null;
    try {
      const d = new Date(lastSyncTime);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return null;
    }
  })();

  // Renderização baseada no visualState normalizado
  const renderBadgeContent = () => {
    switch (visualState) {
      case "CONFLICT":
        return {
          containerClass:
            "bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25",
          dotClass: "bg-rose-500 animate-ping",
          labelDesktop: `${conflictCount} conflito${conflictCount > 1 ? "s" : ""}`,
          labelMobile: `⚠ ${conflictCount}`,
          ariaLabel: `${conflictCount} conflito de sincronização pendente de atenção`,
        };

      case "ERROR":
        return {
          containerClass:
            "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20",
          dotClass: "bg-rose-400",
          labelDesktop: failedCount > 1 ? `${failedCount} erros de envio` : "Erro de envio",
          labelMobile: `✕ ${failedCount}`,
          ariaLabel: "Falha na sincronização",
        };

      case "SYNCING":
        return {
          containerClass:
            "bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25",
          dotClass: "bg-sky-400 animate-spin",
          labelDesktop: "Sincronizando...",
          labelMobile: "🔄",
          ariaLabel: "Sincronizando alterações locais com o servidor",
        };

      case "PENDING":
        return {
          containerClass:
            "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20",
          dotClass: "bg-amber-400 animate-pulse",
          labelDesktop: `${pendingCount} pendência${pendingCount > 1 ? "s" : ""}`,
          labelMobile: `⏳ ${pendingCount}`,
          ariaLabel: `${pendingCount} alterações locais pendentes de sincronização`,
        };

      case "OFFLINE":
        return {
          containerClass:
            "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20",
          dotClass: "bg-amber-400",
          labelDesktop: pendingCount > 0 ? `Offline (${pendingCount})` : "Modo Offline",
          labelMobile: pendingCount > 0 ? `🟠 ${pendingCount}` : "Offline",
          ariaLabel: "Sem conexão com a rede. Exibindo dados locais do IndexedDB.",
        };

      case "SYNCED":
      default:
        return {
          containerClass:
            "bg-[var(--bg-base)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-emerald-500/40",
          dotClass: "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]",
          labelDesktop: "Online",
          labelMobile: "🟢",
          ariaLabel: "Conectado ao Supabase • Dados sincronizados",
        };
    }
  };

  const badge = renderBadgeContent();

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={badge.ariaLabel}
        role="status"
        className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-full text-[11px] font-mono transition-all cursor-pointer select-none active:scale-95 ${badge.containerClass}`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dotClass}`} />

        {/* Versão Desktop */}
        <span className="hidden sm:inline font-semibold">
          {badge.labelDesktop}
          {visualState === "SYNCED" && lastSyncShort && (
            <span className="text-[10px] text-slate-400 opacity-75 ml-1 font-normal">
              ({lastSyncShort})
            </span>
          )}
        </span>

        {/* Versão Mobile Compacta */}
        <span className="sm:hidden font-bold">{badge.labelMobile}</span>
      </button>

      {/* Popover Detalhado */}
      {isOpen && <SyncStatusPopover onClose={() => setIsOpen(false)} />}
    </div>
  );
}

/**
 * Exportação de compatibilidade temporária para garantir que consumidores
 * legados de NetworkStatusBadge continuem funcionando perfeitamente.
 */
export const NetworkStatusBadge = SyncStatusBadge;
