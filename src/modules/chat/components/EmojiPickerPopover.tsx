"use client";

import React, { useEffect, useRef } from "react";

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

const EMOJI_CATEGORIES = [
  {
    name: "Operação & Ferramentas",
    emojis: ["🔧", "🔨", "🪚", "🪛", "⚙️", "🪜", "🎨", "🖌️", "🪵", "🧱", "🧰", "⚡", "🔋", "🔌"],
  },
  {
    name: "Status & Verificação",
    emojis: ["✅", "✔️", "☑️", "⚠️", "🚨", "🛑", "⏳", "⏱️", "🔄", "📌", "📍", "🎯", "📊", "📋", "📦", "🏷️"],
  },
  {
    name: "Reações & Gestos",
    emojis: ["👍", "👎", "👌", "🤝", "🙌", "👏", "💪", "👊", "👀", "✍️", "🚀", "🔥", "⭐", "💡"],
  },
  {
    name: "Expressões",
    emojis: ["😊", "😄", "😎", "🫡", "🤔", "🧐", "😅", "🤝", "👍", "🙏", "⚠️", "❗", "❓", "💯"],
  },
];

export function EmojiPickerPopover({ isOpen, onClose, onSelectEmoji }: EmojiPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full mb-2 left-0 z-50 w-72 bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-100 transition-colors"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
        <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
          <span>😊</span> Emojis da Operação
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-mono px-1 rounded hover:bg-[var(--bg-surface-highlight)] transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-3 pr-1 text-[var(--text-primary)] scrollbar-thin">
        {EMOJI_CATEGORIES.map((category) => (
          <div key={category.name}>
            <span className="text-[10px] font-mono text-[var(--text-muted)] font-medium block mb-1">
              {category.name}
            </span>
            <div className="grid grid-cols-7 gap-1">
              {category.emojis.map((emoji, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectEmoji(emoji)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-blue-500/15 dark:hover:bg-emerald-500/20 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
