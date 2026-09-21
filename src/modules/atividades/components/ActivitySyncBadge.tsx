import React from "react";
import { LocalSyncStatus } from "@/lib/offline";

interface ActivitySyncBadgeProps {
  status?: LocalSyncStatus;
  compact?: boolean;
}

export function ActivitySyncBadge({ status, compact = false }: ActivitySyncBadgeProps) {
  if (!status || status === "synced") {
    return null;
  }

  switch (status) {
    case "pending":
      return (
        <span
          className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30"
          title="Salvo localmente · aguardando envio com o servidor"
        >
          <span className="w-1 h-1 rounded-full bg-amber-400" />
          {compact ? "Pendente" : "Salvo localmente · aguardando envio"}
        </span>
      );

    case "syncing":
      return (
        <span
          className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30"
          title="Enviando alterações para o servidor..."
        >
          <span className="w-1 h-1 rounded-full bg-sky-400 animate-spin" />
          Enviando...
        </span>
      );

    case "conflict":
      return (
        <span
          className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/40"
          title="Conflito de sincronização: alteração requer atenção ou reconciliação"
        >
          <span className="w-1 h-1 rounded-full bg-rose-400" />
          {compact ? "Conflito" : "Conflito de sincronização"}
        </span>
      );

    case "failed":
      return (
        <span
          className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30"
          title="Falha na sincronização: limite de tentativas excedido ou erro definitivo"
        >
          <span className="w-1 h-1 rounded-full bg-rose-400" />
          {compact ? "Falha sync" : "Falha na sincronização"}
        </span>
      );

    default:
      return null;
  }
}
