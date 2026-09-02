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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-lg w-full space-y-5 shadow-2xl">
        <div className="flex justify-between items-start border-b border-slate-200 pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-blue-700 uppercase tracking-wider">
              Movimentação Operacional RSS3
            </span>
            <h2 className="text-base font-bold text-slate-900 leading-snug">
              Adicionar Material (Entrada de Estoque)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Seleção do Material */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Material Cadastrado *
            </label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="w-full bg-white text-slate-900 border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              required
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} - {m.name} (Saldo atual: {m.currentStock} {m.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Quantidade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Quantidade de Entrada *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Ex: 50"
                  className="w-full bg-white text-slate-900 border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono font-bold"
                  required
                />
                <span className="font-mono text-blue-700 font-bold">
                  {selectedMat?.unit || "un"}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lote / Batelada</label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="Ex: LOTE-2026-X"
                className="w-full bg-white text-slate-900 border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* Validade e Documento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data de Validade</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nota Fiscal / Doc.</label>
              <input
                type="text"
                value={documentReference}
                onChange={(e) => setDocumentReference(e.target.value)}
                placeholder="Ex: NF 14592"
                className="w-full bg-white text-slate-900 border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Observações da Entrada</label>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={2}
              placeholder="Ex: Recebido pelo almoxarifado central em perfeito estado."
              className="w-full bg-white text-slate-900 border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-md shadow-xs transition-all active:scale-95"
            >
              {isSubmitting ? "Registrando..." : "Confirmar Entrada"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
