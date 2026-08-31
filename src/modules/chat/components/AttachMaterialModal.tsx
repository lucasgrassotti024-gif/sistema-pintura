"use client";

import React, { useState, useMemo } from "react";
import { Material } from "@/modules/materiais/types/material.types";
import { useMaterials } from "@/modules/materiais/hooks/useMaterials";

interface AttachMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (material: Material) => void;
}

export function AttachMaterialModal({ isOpen, onClose, onSelect }: AttachMaterialModalProps) {
  const { materials, isLoading } = useMaterials();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMaterials = useMemo(() => {
    return materials
      .filter((mat) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const matchesCode = mat.code.toLowerCase().includes(term);
        const matchesName = mat.name.toLowerCase().includes(term);
        const matchesType = mat.type.toLowerCase().includes(term);
        return matchesCode || matchesName || matchesType;
      })
      .slice(0, 15);
  }, [materials, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#0f172a] border border-white/10 rounded-xl max-w-xl w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <h2 className="text-sm font-bold text-slate-100 uppercase font-mono tracking-wider">
              Anexar Insumo/Material à Conversa
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Campo de Busca */}
        <div className="p-3 border-b border-white/10 bg-[#090d16]/50">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔎 Buscar por código (ex: PRI-001), nome ou tipo de tinta..."
            className="w-full bg-[#090d16] border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-hidden"
            autoFocus
          />
        </div>

        {/* Lista de Materiais Selecionáveis */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-slate-400 font-mono">
              Carregando catálogo de materiais...
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 font-mono">
              Nenhum material encontrado com o termo pesquisado.
            </div>
          ) : (
            filteredMaterials.map((mat) => (
              <button
                key={mat.id}
                type="button"
                onClick={() => {
                  onSelect(mat);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-lg bg-[#090d16] hover:bg-emerald-500/5 border border-white/5 hover:border-emerald-500/30 transition-all flex flex-col gap-1.5 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 group-hover:text-emerald-300">
                      {mat.code}
                    </span>
                    <span className="text-xs font-medium text-slate-200 truncate max-w-[280px]">
                      {mat.name}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                      mat.status === "critico"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : mat.status === "atencao"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    ● {mat.status}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                  <span>
                    Saldo: {mat.currentStock} {mat.unit}
                  </span>
                  <span>•</span>
                  <span>
                    Mínimo: {mat.minimumStock} {mat.unit}
                  </span>
                  <span>•</span>
                  <span>Tipo: {mat.type}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Rodapé */}
        <div className="p-3 border-t border-white/10 bg-[#090d16] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded border border-white/10 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
