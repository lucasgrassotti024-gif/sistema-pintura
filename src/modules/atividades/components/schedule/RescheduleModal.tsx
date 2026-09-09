import React, { useState } from "react";
import { Activity } from "../../types/activity.types";
import { calculateDaysDifference, addDaysToDate } from "../../utils/schedule.utils";

interface RescheduleModalProps {
  activity: Activity;
  currentStartDate: string;
  currentEndDate: string;
  onConfirm: (newStartDate: string, newEndDate: string) => void;
  onClose: () => void;
}

export function RescheduleModal({
  activity,
  currentStartDate,
  currentEndDate,
  onConfirm,
  onClose,
}: RescheduleModalProps) {
  const diffDays = calculateDaysDifference(currentStartDate, currentEndDate);
  const duration = diffDays + 1;

  const [selectedDate, setSelectedDate] = useState<string>(currentStartDate);

  const handleConfirm = () => {
    if (!selectedDate) return;
    const newEnd = addDaysToDate(selectedDate, diffDays);
    onConfirm(selectedDate, newEnd);
    onClose();
  };

  const calculatedEndDate = selectedDate ? addDaysToDate(selectedDate, diffDays) : "";

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#0c1524] border border-blue-500/20 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-blue-500/15">
          <div>
            <span className="text-[11px] font-mono text-blue-400 font-bold">
              OS {activity.orderNumber}
            </span>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Reprogramar Atividade
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-slate-300 font-medium line-clamp-2">
            {activity.name}
          </p>

          <div className="p-3 bg-[#070c14] border border-blue-500/15 rounded-lg space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Período atual:</span>
              <span className="font-mono text-slate-200">
                {currentStartDate} a {currentEndDate}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Duração planejada:</span>
              <span className="font-mono font-bold text-orange-400">
                {duration} {duration === 1 ? "dia" : "dias"}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
              Nova Data de Início:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-[#070c14] border border-blue-500/30 focus:border-orange-500 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-hidden"
            />
          </div>

          {selectedDate && (
            <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20">
              Novo período calculado: <strong>{selectedDate}</strong> até <strong>{calculatedEndDate}</strong> (duração de {duration} {duration === 1 ? "dia" : "dias"} preservada).
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-500/15">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedDate}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Aplicar alteração
          </button>
        </div>
      </div>
    </div>
  );
}
