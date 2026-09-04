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
        className="relative max-w-4xl max-h-[90vh] flex flex-col items-center bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-xl overflow-hidden shadow-2xl"
      >
        {/* Barra Superior */}
        <div className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--bg-surface-raised)] border-b border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)]">
          <span className="truncate max-w-md font-medium text-[var(--text-primary)]">
            {imageName || "Foto da Operação"}
          </span>
          <div className="flex items-center gap-3">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-emerald-400 hover:underline font-semibold"
            >
              Abrir Original ↗
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--bg-surface-highlight)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Container da Imagem */}
        <div className="p-2 flex items-center justify-center overflow-auto max-h-[calc(90vh-4rem)] bg-[var(--bg-base)]">
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
