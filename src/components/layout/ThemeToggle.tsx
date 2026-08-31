"use client";

import React from "react";
import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "dark" ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
      aria-label="Alternar tema"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border
                 bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300
                 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 shadow-xs"
    >
      {theme === "dark" ? (
        <>
          <span className="text-amber-400 text-sm">☀️</span>
          <span className="hidden sm:inline">Claro</span>
        </>
      ) : (
        <>
          <span className="text-slate-600 text-sm">🌙</span>
          <span className="hidden sm:inline">Escuro</span>
        </>
      )}
    </button>
  );
}
