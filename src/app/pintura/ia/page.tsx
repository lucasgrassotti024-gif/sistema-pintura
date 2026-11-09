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
  const [attachedImage, setAttachedImage] = useState<{ dataUrl: string; name: string; mimeType: string } | null>(null);

  // Modais de busca e emojis (reutilizados do Chat de Operação)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAttachingActivity, setIsAttachingActivity] = useState(false);
  const [isAttachingMaterial, setIsAttachingMaterial] = useState(false);

  // Detalhes da Atividade
  const [selectedActivityDetails, setSelectedActivityDetails] = useState<Activity | null>(null);
  const [isLoadingActivityDetails, setIsLoadingActivityDetails] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione um arquivo de imagem válido (JPEG, PNG ou WEBP).");
      return;
    }

    // Limite defensivo de 6MB
    if (file.size > 6 * 1024 * 1024) {
      alert("A imagem selecionada é muito grande. O limite máximo é 6MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAttachedImage({
          dataUrl: result,
          name: file.name,
          mimeType: file.type,
        });
      }
    };
    reader.readAsDataURL(file);
    // Limpa o input file para permitir selecionar o mesmo arquivo novamente se desejar
    e.target.value = "";
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
    const hasAttachment = Boolean(attachedActivity || attachedMaterial || attachedImage);

    if ((!query.trim() && !hasAttachment) || isLoading) return;

    sendMessage(query, {
      activity: attachedActivity,
      material: attachedMaterial,
      image: attachedImage,
    });

    setInputQuery("");
    setAttachedActivity(null);
    setAttachedMaterial(null);
    setAttachedImage(null);
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

                  {/* Imagem de Inspeção Anexada (se houver) */}
                  {msg.image?.dataUrl && (
                    <div className="mt-1 max-w-sm rounded-lg overflow-hidden border border-[var(--border-medium)] shadow-md bg-black/40">
                      <img
                        src={msg.image.dataUrl}
                        alt={msg.image.name || "Foto de inspeção"}
                        className="max-h-60 w-auto object-contain rounded-md"
                      />
                      {msg.image.name && (
                        <div className="p-1.5 text-[10px] font-mono text-[var(--text-muted)] truncate bg-[var(--bg-surface)]">
                          📷 {msg.image.name}
                        </div>
                      )}
                    </div>
                  )}

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

                  {!msg.text && !msg.activity && !msg.material && !msg.activities && !msg.materials && !msg.image && (
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

          {/* Tag de Imagem/Foto Anexada pelo Usuário antes de enviar */}
          {attachedImage && (
            <div className="flex items-center gap-2.5 p-2 bg-[var(--bg-surface)] border border-blue-500/40 rounded-lg max-w-md animate-in fade-in">
              <img
                src={attachedImage.dataUrl}
                alt="Preview"
                className="w-10 h-10 object-cover rounded border border-[var(--border-subtle)] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  {attachedImage.name}
                </div>
                <div className="text-[10px] text-blue-400 font-mono">
                  Pronta para análise visual
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                title="Remover foto"
                className="p-1 text-[var(--text-muted)] hover:text-rose-500 rounded transition-colors text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input oculto para carregar arquivo de foto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Barra de Ações Rápidas: Emojis + Foto + Anexar OS + Anexar Material + Limpar Conversa */}
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

            {/* Anexar Foto de Inspeção */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                attachedImage
                  ? "bg-blue-600/20 border-blue-500 text-blue-400"
                  : "bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-medium)] hover:border-blue-500/40"
              }`}
              title="Anexar foto de campo para inspeção de pintura"
            >
              <span>📷</span>
              <span>Foto Inspeção</span>
            </button>

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

          {/* Chips de Prompts Rápidos e Contextuais */}
          {!isLoading && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
              <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0 font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="text-emerald-500">⚡</span> Sugestões:
              </span>
              {attachedImage ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSend("Avalie visualmente esta foto: identifique possíveis patologias ou defeitos na película de pintura (ex: bolhas, escorrimento, casca de laranja).")}
                    className="shrink-0 px-2.5 py-1 bg-blue-950/40 border border-blue-500/40 text-blue-300 hover:text-blue-200 rounded-full transition-colors cursor-pointer"
                  >
                    🔍 Diagnosticar patologias / defeitos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Estime o grau de corrosão e preparação de superfície desta imagem conforme padrões visuais (ISO 8501-1 / SSPC).")}
                    className="shrink-0 px-2.5 py-1 bg-blue-950/40 border border-blue-500/40 text-blue-300 hover:text-blue-200 rounded-full transition-colors cursor-pointer"
                  >
                    🧪 Grau de corrosão (ISO 8501-1)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Avalie a uniformidade da aplicação e cobertura da demão nesta estrutura.")}
                    className="shrink-0 px-2.5 py-1 bg-blue-950/40 border border-blue-500/40 text-blue-300 hover:text-blue-200 rounded-full transition-colors cursor-pointer"
                  >
                    🎨 Uniformidade da demão
                  </button>
                </>
              ) : attachedActivity ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSend("Qual o status atual, avanço e previsão desta OS?")}
                    className="shrink-0 px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-emerald-950/40 border border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-emerald-400 rounded-full transition-colors cursor-pointer"
                  >
                    📊 Status e previsão
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Quanto de material/tinta foi consumido nesta atividade?")}
                    className="shrink-0 px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-emerald-950/40 border border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-emerald-400 rounded-full transition-colors cursor-pointer"
                  >
                    🧪 Consumo apontado
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Quais são as especificações de área, demãos e responsáveis desta OS?")}
                    className="shrink-0 px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-emerald-950/40 border border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-emerald-400 rounded-full transition-colors cursor-pointer"
                  >
                    📋 Detalhes técnicos
                  </button>
                </>
              ) : attachedMaterial ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSend("Qual o saldo em estoque e situação deste material?")}
                    className="shrink-0 px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-emerald-950/40 border border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-emerald-400 rounded-full transition-colors cursor-pointer"
                  >
                    📦 Saldo em estoque
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Existe risco de ruptura ou necessidade de compra deste insumo?")}
                    className="shrink-0 px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-emerald-950/40 border border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-emerald-400 rounded-full transition-colors cursor-pointer"
                  >
                    ⚠️ Risco de falta
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSend("Quais atividades estão com prazo crítico ou atrasadas?")}
                    className="shrink-0 px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-emerald-950/40 border border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-emerald-400 rounded-full transition-colors cursor-pointer"
                  >
                    ⏰ OSs com prazo crítico
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Existe algum material com estoque abaixo do mínimo hoje?")}
                    className="shrink-0 px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-emerald-950/40 border border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-emerald-400 rounded-full transition-colors cursor-pointer"
                  >
                    🚨 Estoque abaixo do mínimo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Resuma o panorama geral de produção de pintura da planta.")}
                    className="shrink-0 px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-emerald-950/40 border border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-emerald-400 rounded-full transition-colors cursor-pointer"
                  >
                    🏭 Panorama da planta
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Calcule o rendimento prático de tinta e volume necessário para uma EPS de 120 micras com airless em 200 m².")}
                    className="shrink-0 px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-emerald-950/40 border border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-emerald-400 rounded-full transition-colors cursor-pointer"
                  >
                    📐 Cálculo de rendimento (EPS)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Quais são as condições ambientais e critérios de aceitação de EPS na norma Petrobras N-1201?")}
                    className="shrink-0 px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-emerald-950/40 border border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-emerald-400 rounded-full transition-colors cursor-pointer"
                  >
                    📜 Regras Petrobras N-1201
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Quais atividades estão em andamento agora?")}
                    className="shrink-0 px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-emerald-950/40 border border-[var(--border-medium)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-emerald-400 rounded-full transition-colors cursor-pointer"
                  >
                    ⚙️ Frentes em andamento
                  </button>
                </>
              )}
            </div>
          )}

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

