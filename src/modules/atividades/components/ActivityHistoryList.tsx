import React from "react";
import { ActivityHistoryEntry } from "../types/activity.types";

interface ActivityHistoryListProps {
  history?: ActivityHistoryEntry[];
}

export function ActivityHistoryList({ history = [] }: ActivityHistoryListProps) {
  if (history.length === 0) {
    return <p className="text-xs text-slate-400 font-mono">Nenhum histórico registrado.</p>;
  }

  return (
    <ul className="space-y-3">
      {history.map((entry) => (
        <li
          key={entry.id}
          className="text-xs border-l-2 border-emerald-500 pl-3 py-2 bg-[#090d16] p-3 rounded-r-md border-y border-r border-white/5 space-y-1.5"
        >
          <div className="flex justify-between items-start">
            <p className="font-bold text-slate-100">{entry.action}</p>
            <span className="text-[10px] text-slate-400 font-mono">{entry.timestamp}</span>
          </div>

          <p className="text-[11px] text-slate-400">
            Responsável: <strong className="text-slate-200">{entry.userName}</strong>
          </p>

          {/* Detalhes de avanço físico */}
          {entry.oldProgress !== undefined && entry.newProgress !== undefined && (
            <p className="text-slate-300 font-mono">
              Progresso: <span className="line-through text-slate-400">{entry.oldProgress}%</span> →{" "}
              <strong className="text-emerald-400">{entry.newProgress}%</strong>
            </p>
          )}

          {/* Materiais consumidos no apontamento */}
          {entry.consumedMaterials && entry.consumedMaterials.length > 0 && (
            <div className="pt-1.5 border-t border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Insumos Consumidos no Apontamento:
              </span>
              <ul className="list-disc list-inside text-[11px] text-slate-300 mt-1 space-y-0.5 font-mono">
                {entry.consumedMaterials.map((m, idx) => (
                  <li key={idx}>
                    {m.materialName}: <strong className="text-emerald-400">{m.quantity} {m.unit}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Observação da execução */}
          {entry.observation && (
            <p className="text-[11px] text-slate-300 mt-1 bg-[#0f172a] p-2 rounded border border-white/5 italic">
              &quot;{entry.observation}&quot;
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

