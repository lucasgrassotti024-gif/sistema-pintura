"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIaChat } from "@/modules/ia/hooks/useIaChat";
import { EmojiPickerPopover } from "@/modules/chat/components/EmojiPickerPopover";
import { AttachActivityModal } from "@/modules/chat/components/AttachActivityModal";
import { AttachMaterialModal } from "@/modules/chat/components/AttachMaterialModal";
import { ActivityAttachmentCard, MaterialAttachmentCard } from "@/modules/chat/components/AttachmentCards";
import { Activity } from "@/modules/atividades/types/activity.types";
import { Material } from "@/modules/materiais/types/material.types";
import { AttachedActivityData, AttachedMaterialData } from "@/modules/chat/types/chat.types";
import { calculateStockStatus } from "@/modules/materiais/rules/material.rules";
import { ActivityDetails } from "@/modules/atividades/components/ActivityDetails";
import { getActivityById } from "@/modules/atividades/services/activity.service";

export default function IAPage() {
  const router = useRouter();
  const {
    messages,
    isLoading,
    isInitializing,
    error,
    sendMessage,
    stopGeneration,
    deleteMessage,
    clearChat,
  } = useIaChat();

  const [inputQuery, setInputQuery] = useState("");
  const [attachedActivity, setAttachedActivity] = useState<AttachedActivityData | null>(null);
  const [attachedMaterial, setAttachedMaterial] = useState<AttachedMaterialData | null>(null);

  // Modais de busca e emojis (reutilizados do Chat de Operação)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAttachingActivity, setIsAttachingActivity] = useState(false);
  const [isAttachingMaterial, setIsAttachingMaterial] = useState(false);

  // Detalhes da Atividade
  const [selectedActivityDetails, setSelectedActivityDetails] = useState<Activity | null>(null);
  const [isLoadingActivityDetails, setIsLoadingActivityDetails] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectEmoji = (emoji: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const current = inputQuery;
      const updated = current.substring(0, start) + emoji + current.substring(end);
      setInputQuery(updated);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setInputQuery((prev) => prev + emoji);
    }
    setIsEmojiPickerOpen(false);
  };

  const handleSelectActivity = (act: Activity) => {
    setAttachedActivity({
      id: act.id,
      orderNumber: act.orderNumber,
      name: act.name,
      status: act.status,
      priority: act.priority,
      progressPercentage: act.progressPercentage,
      plannedEndDate: act.schedule?.plannedEndDate || "",
      areaName: act.location?.area,
      assignedTo: act.assignedTo,
    });
    setAttachedMaterial(null);
  };

  const handleSelectMaterial = (mat: Material) => {
    const cur = Number(mat.currentStock || 0);
    const min = Number(mat.minimumStock || 0);
    setAttachedMaterial({
      id: mat.id,
      code: mat.code,
      name: mat.name,
      type: mat.type,
      unit: mat.unit,
      currentStock: cur,
      minimumStock: min,
      status: calculateStockStatus(cur, min),
    });
    setAttachedActivity(null);
  };

  const handleOpenActivityDetails = async (activityId: string) => {
    setIsLoadingActivityDetails(true);
    try {
      const act = await getActivityById(activityId);
      if (act) setSelectedActivityDetails(act);
    } catch (err) {
      console.error("Erro ao carregar detalhes da atividade:", err);
    } finally {
      setIsLoadingActivityDetails(false);
    }
  };

  const handleSend = (textToSend?: string) => {
    const query = textToSend !== undefined ? textToSend : inputQuery;
    const hasAttachment = Boolean(attachedActivity || attachedMaterial);

    if ((!query.trim() && !hasAttachment) || isLoading) return;

    sendMessage(query, {
      activity: attachedActivity,
      material: attachedMaterial,
    });

    setInputQuery("");
    setAttachedActivity(null);
    setAttachedMaterial(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] sm:h-[calc(100vh-7rem)] min-h-[520px] max-w-5xl mx-auto w-full transition-all duration-200">
      {/* JANELA DE CONVERSA PRINCIPAL EXPANDIDA */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-md flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto space-y-4 bg-[var(--bg-base)]">
          {messages.map((msg) => {
            const isUser = msg.sender === "user";

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"} group animate-in fade-in duration-150`}
                >
                  {/* Identificador da Mensagem */}
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isUser
                          ? "text-emerald-500 dark:text-emerald-400"
                          : "text-blue-600 dark:text-blue-400 flex items-center gap-1"
                      }`}
                    >
                      {isUser ? "[Você]" : "● Assistente Operacional RSS3"}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{msg.timestamp}</span>

                    {/* Botão de Excluir Mensagem */}
                    {isUser && (
                      <button
                        type="button"
                        onClick={() => deleteMessage(msg.id)}
                        title="Excluir minha mensagem"
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-rose-500 transition-opacity ml-1 p-0.5 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Cards de Atividades (Desduplicados estritamente por ID/OrderNumber) */}
                  {(() => {
                    const allActs: AttachedActivityData[] = [];
                    if (msg.activity) allActs.push(msg.activity);
                    if (msg.activities) {
                      for (const a of msg.activities) {
                        if (!allActs.some((item) => item.id === a.id || item.orderNumber === a.orderNumber)) {
                          allActs.push(a);
                        }
                      }
                    }
                    if (allActs.length === 0) return null;
                    return (
                      <div className="flex flex-col gap-2 w-full max-w-md">
                        {allActs.map((act) => (
                          <ActivityAttachmentCard
                            key={act.id}
                            activity={act}
                            onOpenDetails={handleOpenActivityDetails}
                          />
                        ))}
                      </div>
                    );
                  })()}

                  {/* Cards de Materiais (Desduplicados estritamente por ID/Código) */}
                  {(() => {
                    const allMats: AttachedMaterialData[] = [];
                    if (msg.material) allMats.push(msg.material);
                    if (msg.materials) {
                      for (const m of msg.materials) {
                        if (!allMats.some((item) => item.id === m.id || (m.code && item.code === m.code))) {
                          allMats.push(m);
                        }
                      }
                    }
                    if (allMats.length === 0) return null;
                    return (
                      <div className="flex flex-col gap-2 w-full max-w-md">
                        {allMats.map((mat) => (
                          <MaterialAttachmentCard
                            key={mat.id}
                            material={mat}
                            onOpenDetails={() => {
                              router.push("/pintura/materiais-estoque");
                            }}
                          />
                        ))}
                      </div>
                    );
                  })()}

                  {/* Bolha Textual da Mensagem */}
                  {msg.text && (
                    <div
                      className={`max-w-[95%] sm:max-w-[85%] rounded-lg p-3.5 sm:p-4 text-xs leading-relaxed border break-words overflow-x-auto mt-1 ${
                        isUser
                          ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                          : "bg-[var(--bg-surface)] border-[var(--border-medium)] text-[var(--text-primary)] shadow-sm"
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans space-y-2">
                        {msg.text}
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-3.5 ml-1 bg-emerald-500 animate-pulse align-middle" />
                        )}
                      </div>
                    </div>
                  )}

                  {!msg.text && !msg.activity && !msg.material && !msg.activities && !msg.materials && (
                    <div className="flex items-center gap-2 text-[var(--text-muted)] font-mono py-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Consultando dados operacionais da planta...
                    </div>
                  )}
                </div>
              );
            })}

          <div ref={chatBottomRef} />
        </div>

        {error && (
          <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/30 text-xs text-rose-600 dark:text-rose-300 flex items-center justify-between shrink-0 font-mono">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => clearChat()}
              className="text-[11px] underline hover:opacity-80 font-mono cursor-pointer"
            >
              Reiniciar
            </button>
          </div>
        )}

        {/* Rodapé: Vínculos Anexados + Ações Rápidas + Campo de Entrada */}
        <div className="p-3 sm:p-3.5 bg-[var(--bg-surface-raised)] border-t border-[var(--border-subtle)] space-y-2.5 shrink-0 relative transition-colors duration-200">
          {/* Tag de Atividade Anexada pelo Usuário antes de enviar */}
          {attachedActivity && (
            <div className="flex items-center gap-2 p-2 bg-[var(--bg-surface)] border border-emerald-500/40 rounded-lg max-w-md animate-in fade-in">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {attachedActivity.orderNumber}
              </span>
              <span className="text-xs text-[var(--text-primary)] font-medium truncate flex-1">
                {attachedActivity.name}
              </span>
              <button
                type="button"
                onClick={() => setAttachedActivity(null)}
                title="Remover anexo"
                className="p-1 text-[var(--text-muted)] hover:text-rose-500 rounded transition-colors text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Tag de Material Anexado pelo Usuário antes de enviar */}
          {attachedMaterial && (
            <div className="flex items-center gap-2 p-2 bg-[var(--bg-surface)] border border-emerald-500/40 rounded-lg max-w-md animate-in fade-in">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {attachedMaterial.code}
              </span>
              <span className="text-xs text-[var(--text-primary)] font-medium truncate flex-1">
                {attachedMaterial.name} ({attachedMaterial.currentStock} {attachedMaterial.unit})
              </span>
              <button
                type="button"
                onClick={() => setAttachedMaterial(null)}
                title="Remover anexo"
                className="p-1 text-[var(--text-muted)] hover:text-rose-500 rounded transition-colors text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Barra de Ações Rápidas: Emojis + Anexar OS + Anexar Material + Limpar Conversa */}
          <div className="flex items-center gap-2 relative flex-wrap">
            {/* Popover de Emojis Reutilizado */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)] border text-sm transition-colors cursor-pointer ${
                  isEmojiPickerOpen
                    ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                    : "border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                title="Inserir Emoji"
              >
                😊
              </button>

              <EmojiPickerPopover
                isOpen={isEmojiPickerOpen}
                onClose={() => setIsEmojiPickerOpen(false)}
                onSelectEmoji={handleSelectEmoji}
              />
            </div>

            <span className="text-[var(--border-medium)]">|</span>

            {/* Anexar Atividade */}
            <button
              type="button"
              onClick={() => setIsAttachingActivity(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-medium)] hover:border-emerald-500/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>+</span>
              <span>Atividade</span>
            </button>

            {/* Anexar Material */}
            <button
              type="button"
              onClick={() => setIsAttachingMaterial(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-medium)] hover:border-emerald-500/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>+</span>
              <span>Material</span>
            </button>

            {/* Status de Sincronização & Botão Limpar Conversa (no canto direito da barra) */}
            <div className="ml-auto flex items-center gap-2">
              {isInitializing && (
                <span className="text-[10px] font-mono text-emerald-500 animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Sincronizando...
                </span>
              )}
              <button
                type="button"
                onClick={clearChat}
                disabled={isLoading || messages.length <= 1}
                className="text-[11px] font-semibold px-2.5 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-highlight)] disabled:opacity-30 text-[var(--text-secondary)] hover:text-rose-400 rounded-md border border-[var(--border-medium)] hover:border-rose-500/40 transition-colors cursor-pointer flex items-center gap-1.5"
                title="Limpar mensagens da conversa"
              >
                <span>🗑️</span>
                <span>Limpar Conversa</span>
              </button>
            </div>
          </div>

          {/* Campo de Texto e Botão de Envio */}
          <div className="flex items-end gap-2.5">
            <textarea
              ref={textareaRef}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={
                attachedActivity
                  ? `Pergunte algo sobre a OS ${attachedActivity.orderNumber} (ex: "Quanto de tinta ela consome?")`
                  : attachedMaterial
                  ? `Pergunte algo sobre o material ${attachedMaterial.code} (ex: "Qual a situação do estoque?")`
                  : "Pergunte sobre atividades, prazos, estoque ou uma OS... (Enter para enviar)"
              }
              rows={2}
              className="flex-1 bg-[var(--bg-input)] border border-[var(--border-medium)] focus:border-emerald-500 rounded-lg p-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-hidden resize-none transition-colors shadow-xs"
            />

            {isLoading ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shrink-0 cursor-pointer"
              >
                Parar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputQuery.trim() && !attachedActivity && !attachedMaterial}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors shadow-md shrink-0 flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <span>Enviar</span>
                <span>➤</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modais Reutilizados do Chat de Operação */}
      <AttachActivityModal
        isOpen={isAttachingActivity}
        onClose={() => setIsAttachingActivity(false)}
        onSelect={handleSelectActivity}
      />

      <AttachMaterialModal
        isOpen={isAttachingMaterial}
        onClose={() => setIsAttachingMaterial(false)}
        onSelect={handleSelectMaterial}
      />

      {/* Modal de Detalhes da Atividade (ao clicar no card) */}
      {selectedActivityDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ActivityDetails
              activity={selectedActivityDetails}
              onClose={() => setSelectedActivityDetails(null)}
            />
          </div>
        </div>
      )}

      {isLoadingActivityDetails && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg bg-[var(--bg-surface)] border border-emerald-500/30 text-xs font-mono text-[var(--text-primary)] shadow-xl animate-pulse">
          Carregando dados da atividade...
        </div>
      )}
    </div>
  );
}

