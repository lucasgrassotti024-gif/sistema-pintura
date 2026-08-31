"use client";

import React, { useState } from "react";
import { Activity } from "../types/activity.types";
import { generateActivityPdf } from "../services/activity-pdf.service";

interface GeneratePdfModalProps {
  activity: Activity;
  onClose: () => void;
}

export function GeneratePdfModal({ activity, onClose }: GeneratePdfModalProps) {
  const [includePhotos, setIncludePhotos] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsGenerating(true);

    try {
      await generateActivityPdf(activity, { includePhotos });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar o relatório em PDF.";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-lg p-6 max-w-md w-full space-y-5 shadow-2xl">
        {/* Cabeçalho do Modal */}
        <div className="flex justify-between items-start border-b border-white/5 pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              Exportação Técnica
            </span>
            <h2 className="text-base font-bold text-slate-100 leading-snug mt-0.5">
              Gerar Relatório em PDF
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
          >
            Fechar
          </button>
        </div>

        {/* Resumo da Atividade */}
        <div className="bg-[#090d16] border border-white/5 rounded-md p-3.5 space-y-1 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">Ordem de Serviço:</span>
            <span className="font-bold text-emerald-400">{activity.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Atividade:</span>
            <span className="font-semibold text-slate-200 truncate max-w-[200px]" title={activity.name}>
              {activity.name}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-500/10 text-rose-300 border border-rose-500/30 rounded-md font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-5">
          {/* Opções de Inclusão */}
          <div className="space-y-3">
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wide">
              Opções do Relatório:
            </label>

            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  !includePhotos
                    ? "bg-emerald-500/10 border-emerald-500/30 text-slate-100"
                    : "bg-[#090d16] border-white/5 text-slate-400 hover:border-white/10"
                }`}
              >
                <input
                  type="radio"
                  name="pdfOption"
                  checked={!includePhotos}
                  onChange={() => setIncludePhotos(false)}
                  disabled={isGenerating}
                  className="accent-emerald-500"
                />
                <div className="text-xs">
                  <p className="font-semibold text-slate-100">PDF sem fotos</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Relatório com dados de identificação, cronograma, materiais e histórico.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  includePhotos
                    ? "bg-emerald-500/10 border-emerald-500/30 text-slate-100"
                    : "bg-[#090d16] border-white/5 text-slate-400 hover:border-white/10"
                }`}
              >
                <input
                  type="radio"
                  name="pdfOption"
                  checked={includePhotos}
                  onChange={() => setIncludePhotos(true)}
                  disabled={isGenerating}
                  className="accent-emerald-500"
                />
                <div className="text-xs">
                  <p className="font-semibold text-slate-100">PDF com fotos</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Inclui anexo com registro fotográfico estruturado (quando disponível).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-md transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-md shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] transition-all"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Gerando Documento...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Gerar Documento PDF</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
