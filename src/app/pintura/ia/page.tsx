"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIaChat } from "@/modules/ia/hooks/useIaChat";
import { useActivities } from "@/modules/atividades/hooks/useActivities";
import { useMaterials } from "@/modules/materiais/hooks/useMaterials";
import { isActivityDelayed } from "@/modules/atividades/rules/activity.rules";
import { formatDateISO } from "@/modules/atividades/utils/week.utils";
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

  const { rawActivities } = useActivities();
  const { materials } = useMaterials();

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

  const todayISO = useMemo(() => formatDateISO(new Date()), []);
  const tomorrowISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateISO(d);
  }, []);

  const summary = useMemo(() => {
    try {
      const active = (rawActivities || []).filter(
        (a) =>
          a &&
          (a.status === "programada" ||
            a.status === "em_andamento" ||
            a.status === "planejada" ||
            a.status === "pausada")
      );

      const delayed = active.filter((a) => {
        try {
          return isActivityDelayed(a, todayISO);
        } catch {
          return false;
        }
      });

      const dueSoon = active.filter((a) => {
        const plannedEnd = a.schedule?.plannedEndDate;
        if (!plannedEnd) return false;
        return (
          plannedEnd >= todayISO &&
          plannedEnd <= tomorrowISO &&
          Number(a.progressPercentage || 0) < 80
        );
      });

      const criticalMaterials = (materials || []).filter(
        (m) => m && m.active && Number(m.currentStock || 0) < Number(m.minimumStock || 0)
      );

      return {
        activeCount: active.length,
        delayedCount: delayed.length,
        dueSoonCount: dueSoon.length,
        criticalMaterialsCount: criticalMaterials.length,
      };
    } catch (err) {
      console.warn("[IAPage] Falha defensiva ao calcular summary operacional:", err);
      return {
        activeCount: 0,
        delayedCount: 0,
        dueSoonCount: 0,
        criticalMaterialsCount: 0,
      };
    }
  }, [rawActivities, materials, todayISO, tomorrowISO]);

  const dynamicSuggestions = useMemo(() => {
    const list: string[] = [];

    if (summary.delayedCount > 0) {
      list.push("Quais atividades estão atrasadas e quais os responsáveis?");
    }

    if (summary.criticalMaterialsCount > 0) {
      list.push("Quais insumos estão abaixo do estoque mínimo e podem comprometer frentes?");
    }

    if (summary.dueSoonCount > 0) {
      list.push("Existe risco de atraso nas atividades que vencem amanhã?");
    }

    if (summary.activeCount > 0) {
      list.push("Faça um resumo executivo da operação de pintura hoje.");
    }

    if (list.length < 4) {
      list.push("Qual atividade em andamento apresenta maior criticidade?");
    }

    return list.slice(0, 4);
  }, [summary]);

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
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] sm:h-[calc(100vh-7rem)] min-h-[520px] max-w-5xl mx-auto w-full gap-3 transition-all duration-200">
      {/* 1. CABEÇALHO TÉCNICO */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
              Inteligência Operacional RSS3
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              Read-Only • Gemini Flash Latest
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Assistente técnico com suporte a anexos de ordens de serviço, insumos de pintura e diagnósticos cruzados.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {isInitializing && (
            <span className="text-[11px] font-mono text-emerald-500 animate-pulse flex items-center gap-1.5 mr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sincronizando histórico...
            </span>
          )}
          <button
            type="button"
            onClick={clearChat}
            disabled={isLoading || messages.length <= 1}
            className="text-xs font-semibold px-3 py-1.5 bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-highlight)] disabled:opacity-30 text-[var(--text-secondary)] rounded-md border border-[var(--border-medium)] transition-colors cursor-pointer"
          >
            Limpar Conversa
          </button>
        </div>
      </div>

      {/* 2. SUGESTÕES RÁPIDAS */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3.5 sm:px-4 py-2.5 space-y-2 shadow-sm shrink-0">
        <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Sugestões de Consulta Operacional:
        </span>
        <div className="flex flex-wrap gap-2 max-h-24 sm:max-h-none overflow-y-auto">
          {dynamicSuggestions.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={isLoading}
              className="text-xs bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-highlight)] border border-[var(--border-medium)] hover:border-emerald-500/40 disabled:opacity-50 px-3 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-left font-medium cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* 3. JANELA DE CONVERSA PRINCIPAL */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-md flex flex-col flex-1 min-h-[300px] overflow-hidden">
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

                  {/* Card de Atividade(s) Anexada(s) ou Detectada(s) */}
                  {msg.activity && (
                    <ActivityAttachmentCard
                      activity={msg.activity}
                      onOpenDetails={handleOpenActivityDetails}
                    />
                  )}
                  {msg.activities &&
                    msg.activities.map((act) => (
                      <ActivityAttachmentCard
                        key={act.id}
                        activity={act}
                        onOpenDetails={handleOpenActivityDetails}
                      />
                    ))}

                  {/* Card de Material(is) Anexado(s) ou Detectado(s) */}
                  {msg.material && (
                    <MaterialAttachmentCard
                      material={msg.material}
                      onOpenDetails={() => {
                        router.push("/pintura/materiais-estoque");
                      }}
                    />
                  )}
                  {msg.materials &&
                    msg.materials.map((mat) => (
                      <MaterialAttachmentCard
                        key={mat.id}
                        material={mat}
                        onOpenDetails={() => {
                          router.push("/pintura/materiais-estoque");
                        }}
                      />
                    ))}

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

          {/* Barra de Ações Rápidas: Emojis + Anexar OS + Anexar Material */}
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

