"use client";

import React, { useState } from "react";
import { Material, StockEntryInput } from "../types/material.types";

interface StockEntryModalProps {
  materials: Material[];
  initialSelectedMaterialId?: string;
  onConfirm: (input: StockEntryInput) => Promise<void>;
  onClose: () => void;
}

export function StockEntryModal({
  materials,
  initialSelectedMaterialId,
  onConfirm,
  onClose,
}: StockEntryModalProps) {
  const [selectedMaterialId, setSelectedMaterialId] = useState(
    initialSelectedMaterialId || (materials.length > 0 ? materials[0].id : "")
  );
  const [quantity, setQuantity] = useState("");
  const [batch, setBatch] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [documentReference, setDocumentReference] = useState("");
  const [observation, setObservation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMat = materials.find((m) => m.id === selectedMaterialId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedMaterialId) {
      setError("Selecione o material para a entrada de estoque.");
      return;
    }

    const qtyNum = Number(quantity);
    if (!quantity || isNaN(qtyNum) || qtyNum <= 0) {
      setError("Informe uma quantidade válida e maior que zero.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        materialId: selectedMaterialId,
        quantity: qtyNum,
        batch: batch.trim() || undefined,
        expirationDate: expirationDate || undefined,
        documentReference: documentReference.trim() || undefined,
        observation: observation.trim() || undefined,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao registrar entrada de estoque.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-lg p-6 max-w-lg w-full space-y-5 shadow-2xl">
        <div className="flex justify-between items-start border-b border-white/5 pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
              Movimentação Operacional
            </span>
            <h2 className="text-base font-bold text-slate-100 leading-snug">
              Adicionar Material (Entrada de Estoque)
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

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Seleção do Material */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Material Cadastrado *
            </label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="w-full bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              required
            >
              <option value="" disabled>
                Selecione um material...
              </option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} - {m.name} (Saldo atual: {m.currentStock} {m.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Quantidade a Adicionar */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Quantidade a Adicionar *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Ex: 50"
                  className="w-full bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 pr-12 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  required
                />
                <span className="absolute right-3 top-2 text-slate-400 font-mono text-xs">
                  {selectedMat?.unit || "-"}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Lote da Remessa (Opcional)
              </label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="Ex: L-2026-09A"
                className="w-full bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Validade do Lote (Opcional)
              </label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Nota Fiscal / Documento (Opcional)
              </label>
              <input
                type="text"
                value={documentReference}
                onChange={(e) => setDocumentReference(e.target.value)}
                placeholder="Ex: NF 10423"
                className="w-full bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Observações do Recebimento (Opcional)
            </label>
            <textarea
              rows={2}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: Entrega recebida sem avarias no almoxarifado químico..."
              className="w-full bg-[#090d16] text-slate-200 border border-white/10 rounded px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {selectedMat && quantity && Number(quantity) > 0 && (
            <div className="p-3 bg-[#090d16] border border-emerald-500/20 rounded text-xs space-y-1 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Saldo Atual:</span>
                <span>{selectedMat.currentStock} {selectedMat.unit}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold border-t border-white/5 pt-1">
                <span>Novo Saldo Previsto:</span>
                <span>{(selectedMat.currentStock + Number(quantity)).toFixed(2)} {selectedMat.unit}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 font-semibold text-slate-300 hover:bg-white/5 rounded border border-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 rounded shadow-[0_0_12px_-2px_rgba(16,185,129,0.4)] transition-colors"
            >
              {isSubmitting ? "Registrando..." : "Confirmar Entrada"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
