"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "../hooks/useChat";
import { useAuth } from "@/context/AuthContext";
import { AttachActivityModal } from "./AttachActivityModal";
import { AttachMaterialModal } from "./AttachMaterialModal";
import { ActivityAttachmentCard, MaterialAttachmentCard } from "./AttachmentCards";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { ImageLightboxModal } from "./ImageLightboxModal";
import { uploadChatImage } from "../services/chat.service";
import { Activity } from "@/modules/atividades/types/activity.types";
import { Material } from "@/modules/materiais/types/material.types";
import { ActivityDetails } from "@/modules/atividades/components/ActivityDetails";
import { getActivityById } from "@/modules/atividades/services/activity.service";

export function ChatView() {
  const { user } = useAuth();
  const {
    messages,
    onlineUsers,
    isLoading,
    isSending,
    error: chatError,
    roomContext,
    sendMessage,
    deleteMessage,
  } = useChat();

  const [inputContent, setInputContent] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAttachingActivity, setIsAttachingActivity] = useState(false);
  const [isAttachingMaterial, setIsAttachingMaterial] = useState(false);
  const [selectedActivityDetails, setSelectedActivityDetails] = useState<Activity | null>(null);
  const [isLoadingActivityDetails, setIsLoadingActivityDetails] = useState(false);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Rolagem automática
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Preview de imagem
  useEffect(() => {
    if (!selectedImageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedImageFile);
    setImagePreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImageFile]);

  const handleSelectEmoji = (emoji: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const current = inputContent;
      const updated = current.substring(0, start) + emoji + current.substring(end);
      setInputContent(updated);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setInputContent((prev) => prev + emoji);
    }
    setIsEmojiPickerOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validMimes = ["image/jpeg", "image/png", "image/webp"];
      if (!validMimes.includes(file.type)) {
        setUploadError("Formato inválido. Aceito apenas JPG, PNG ou WEBP.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError("Tamanho máximo excedido (limite de 5 MB).");
        return;
      }
      setSelectedImageFile(file);
    }
  };

  const handleRemoveSelectedImage = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendMessage = async () => {
    const trimmed = inputContent.trim();
    if ((!trimmed && !selectedImageFile) || isSending || isUploadingImage) return;

    setUploadError(null);

    let uploadedImageUrl: string | undefined = undefined;
    let uploadedImageName: string | undefined = undefined;

    if (selectedImageFile) {
      setIsUploadingImage(true);
      try {
        const uploadResult = await uploadChatImage(selectedImageFile);
        uploadedImageUrl = uploadResult.url;
        uploadedImageName = uploadResult.fileName;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao enviar imagem.";
        setUploadError(msg);
        setIsUploadingImage(false);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    try {
      await sendMessage({
        content: trimmed || undefined,
        imageUrl: uploadedImageUrl,
        imageName: uploadedImageName,
      });

      setInputContent("");
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      // Tratado pelo hook
    }
  };

  const handleSelectActivity = async (activity: Activity) => {
    try {
      await sendMessage({
        activityId: activity.id,
        content: inputContent.trim() || undefined,
      });
      setInputContent("");
    } catch {
      // Tratado pelo hook
    }
  };

  const handleSelectMaterial = async (material: Material) => {
    try {
      await sendMessage({
        materialId: material.id,
        content: inputContent.trim() || undefined,
      });
      setInputContent("");
    } catch {
      // Tratado pelo hook
    }
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const activeError = uploadError || chatError;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100dvh-7rem)] sm:h-[calc(100vh-6.5rem)] w-full mx-auto">
      {/* 1. PAINEL PRINCIPAL DO CHAT */}
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden min-w-0">
        {/* Cabeçalho Técnico da Sala */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 border border-blue-200 flex items-center justify-center font-bold text-sm">
              💬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                  Chat da Operação
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  Sala Operacional RSS3
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Comunicação em tempo real entre operadores, inspetores e coordenação de pintura.
              </p>
            </div>
          </div>

          {/* Indicador de Presença */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-700 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="font-bold text-slate-900">{onlineUsers.length}</span>
            <span className="text-slate-500">online</span>
          </div>
        </div>

        {/* Área de Rolagem das Mensagens */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/50">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping mr-2" />
              Sincronizando mensagens da operação...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 font-mono text-xs">
              <span className="text-3xl mb-2">💬</span>
              <span className="text-slate-700 font-medium">Nenhuma mensagem enviada ainda.</span>
              <span className="mt-1 text-slate-400">Inicie a conversa, envie uma foto ou anexe uma OS/Material.</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = user?.id === msg.userId;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? "items-end" : "items-start"} group animate-in fade-in duration-150`}
                >
                  {/* Cabeçalho da Mensagem */}
                  <div className="flex items-center gap-2 mb-1 px-1 text-[10px] font-mono">
                    <span
                      className={`font-bold ${
                        isMine ? "text-blue-700" : "text-slate-700"
                      }`}
                    >
                      {isMine ? "Você" : msg.user.fullName}
                    </span>
                    <span className="text-slate-500 uppercase px-1.5 py-0.2 bg-slate-100 rounded border border-slate-200">
                      {msg.user.role}
                    </span>
                    <span className="text-slate-400">
                      {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    {/* Botão de Excluir */}
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => deleteMessage(msg.id)}
                        title="Excluir minha mensagem"
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity ml-1 p-0.5"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Foto Anexada */}
                  {msg.imageUrl && (
                    <div className="mb-2 max-w-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.imageUrl}
                        alt={msg.imageName || "Foto da operação"}
                        onClick={() => setLightboxImage({ url: msg.imageUrl!, name: msg.imageName || undefined })}
                        className="rounded-lg max-h-64 object-cover border border-slate-300 hover:border-blue-500 cursor-pointer transition-all shadow-xs hover:scale-[1.01]"
                      />
                    </div>
                  )}

                  {/* Conteúdo Textual */}
                  {msg.content && (
                    <div
                      className={`rounded-xl px-4 py-2.5 text-xs leading-relaxed max-w-[85%] break-words border shadow-xs ${
                        isMine
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white border-slate-200 text-slate-800"
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}

                  {/* Cartão de Atividade Anexada */}
                  {(msg.activity || msg.isActivityDeleted) && (
                    <ActivityAttachmentCard
                      activity={msg.activity}
                      isDeleted={msg.isActivityDeleted}
                      onOpenDetails={handleOpenActivityDetails}
                    />
                  )}

                  {/* Cartão de Material Anexado */}
                  {(msg.material || msg.isMaterialDeleted) && (
                    <MaterialAttachmentCard
                      material={msg.material}
                      isDeleted={msg.isMaterialDeleted}
                      onOpenDetails={() => {
                        window.location.href = "/pintura/materiais-estoque";
                      }}
                    />
                  )}
                </div>
              );
            })
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Barra de Erro */}
        {activeError && (
          <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-xs text-rose-700 flex items-center justify-between shrink-0 font-mono">
            <span>⚠️ {activeError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-[11px] underline hover:text-rose-900"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Rodapé: Ações de Anexo + Preview de Imagem + Campo de Entrada */}
        <div className="p-3.5 bg-white border-t border-slate-200 space-y-3 shrink-0 relative">
          {/* Prévia da Imagem Selecionada */}
          {imagePreviewUrl && (
            <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg max-w-sm animate-in fade-in">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreviewUrl}
                alt="Prévia da foto"
                className="w-14 h-14 object-cover rounded-md border border-slate-300"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-slate-800 font-medium block truncate">
                  {selectedImageFile?.name}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {selectedImageFile ? (selectedImageFile.size / 1024).toFixed(1) + " KB" : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveSelectedImage}
                title="Remover foto"
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors text-sm"
              >
                ✕
              </button>
            </div>
          )}

          {/* Barra de Ações Rápidas */}
          <div className="flex items-center gap-2 relative flex-wrap">
            {/* Popover de Emojis */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 border text-sm transition-colors ${
                  isEmojiPickerOpen
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-slate-300 hover:border-blue-400 text-slate-600 hover:text-blue-600"
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

            {/* Botão de Envio de Foto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 text-xs font-semibold transition-colors"
              title="Anexar Foto (JPG, PNG, WEBP)"
            >
              <span>📷</span>
              <span className="hidden sm:inline">Foto</span>
            </button>

            <span className="text-slate-300">|</span>

            {/* Botões de Vínculos */}
            <button
              type="button"
              onClick={() => setIsAttachingActivity(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 text-xs font-semibold transition-colors"
            >
              <span>+</span>
              <span>Atividade</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAttachingMaterial(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 text-xs font-semibold transition-colors"
            >
              <span>+</span>
              <span>Material</span>
            </button>
          </div>

          {/* Campo de Texto e Botão Enviar */}
          <div className="flex items-end gap-2.5">
            <textarea
              ref={textareaRef}
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending || isUploadingImage}
              placeholder={
                selectedImageFile
                  ? "Adicione uma legenda para a foto ou pressione Enviar..."
                  : "Escreva uma mensagem sobre a operação... (Enter para enviar)"
              }
              rows={2}
              className="flex-1 bg-white border border-slate-300 focus:border-blue-600 rounded-lg p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden resize-none transition-colors"
            />

            <button
              type="button"
              onClick={handleSendMessage}
              disabled={(!inputContent.trim() && !selectedImageFile) || isSending || isUploadingImage}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors shadow-xs shrink-0 flex items-center gap-1.5 active:scale-95"
            >
              {isSending || isUploadingImage ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enviando</span>
                </>
              ) : (
                <>
                  <span>Enviar</span>
                  <span>➤</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. PAINEL LATERAL DE CONTEXTO */}
      <div className="hidden lg:flex flex-col w-72 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden shrink-0">
        {/* Topo do Painel */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50">
          <h2 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
            Contexto da Operação
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Itens e operadores ativos na conversa
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-5 bg-white">
          {/* Usuários Online */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              Operadores Online ({onlineUsers.length}):
            </span>
            <div className="space-y-1.5">
              {onlineUsers.map((u) => (
                <div
                  key={u.userId}
                  className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <span className="text-xs text-slate-800 font-medium truncate">
                    {u.fullName}
                  </span>
                  <span className="text-[10px] font-mono text-blue-700 uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Atividades Mencionadas */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              Ordens de Serviço em Pauta ({roomContext.activities.length}):
            </span>
            {roomContext.activities.length === 0 ? (
              <div className="text-[11px] text-slate-400 font-mono italic">
                Nenhuma OS anexada recentemente.
              </div>
            ) : (
              <div className="space-y-2">
                {roomContext.activities.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => handleOpenActivityDetails(act.id)}
                    className="w-full text-left p-2.5 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-all flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-mono font-bold text-blue-700">
                        {act.orderNumber}
                      </span>
                      <span className="text-[10px] font-mono text-blue-700 font-semibold">
                        {act.progressPercentage}%
                      </span>
                    </div>
                    <span className="text-xs text-slate-800 truncate">{act.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Materiais Mencionados */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              Insumos em Pauta ({roomContext.materials.length}):
            </span>
            {roomContext.materials.length === 0 ? (
              <div className="text-[11px] text-slate-400 font-mono italic">
                Nenhum material anexado recentemente.
              </div>
            ) : (
              <div className="space-y-2">
                {roomContext.materials.map((mat) => (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => {
                      window.location.href = "/pintura/materiais-estoque";
                    }}
                    className="w-full text-left p-2.5 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-all flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-mono font-bold text-blue-700">
                        {mat.code}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${
                          mat.status === "critico"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : mat.status === "atencao"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {mat.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-800 truncate">{mat.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Saldo: {mat.currentStock} {mat.unit}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modais de Anexo */}
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

      {/* Modal de Detalhes da Atividade Clicada */}
      {selectedActivityDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ActivityDetails
              activity={selectedActivityDetails}
              onClose={() => setSelectedActivityDetails(null)}
            />
          </div>
        </div>
      )}

      {/* Lightbox Modal de Imagem */}
      {lightboxImage && (
        <ImageLightboxModal
          imageUrl={lightboxImage.url}
          imageName={lightboxImage.name}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {isLoadingActivityDetails && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg bg-white border border-slate-300 text-xs font-mono text-slate-800 shadow-lg animate-pulse">
          Carregando dados da atividade...
        </div>
      )}
    </div>
  );
}
