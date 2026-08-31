"use client";

import React, { useEffect } from "react";

interface ImageLightboxModalProps {
  imageUrl: string;
  imageName?: string;
  onClose: () => void;
}

export function ImageLightboxModal({ imageUrl, imageName, onClose }: ImageLightboxModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[90vh] flex flex-col items-center bg-[#0f172a] border border-white/10 rounded-xl overflow-hidden shadow-2xl"
      >
        {/* Barra Superior */}
        <div className="w-full flex items-center justify-between px-4 py-2.5 bg-[#090d16] border-b border-white/10 text-xs font-mono text-slate-300">
          <span className="truncate max-w-md font-medium text-slate-200">
            {imageName || "Foto da Operação"}
          </span>
          <div className="flex items-center gap-3">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              Abrir Original ↗
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-slate-100 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Container da Imagem */}
        <div className="p-2 flex items-center justify-center overflow-auto max-h-[calc(90vh-4rem)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageName || "Foto ampliada da operação"}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-md"
          />
        </div>
      </div>
    </div>
  );
}
