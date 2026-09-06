"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { IaChatMessage, IaConversation } from "../types/ia.types";
import { AttachedActivityData, AttachedMaterialData } from "@/modules/chat/types/chat.types";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  getLatestActiveConversation,
  createConversation,
  saveIaMessage,
  deleteIaMessage,
} from "../services/ia-conversation.service";

const INITIAL_WELCOME_MESSAGE: IaChatMessage = {
  id: "init-welcome",
  sender: "ia",
  text: "Olá! Sou o Assistente Operacional de Engenharia do Sistema de Pintura Industrial. Estou conectado aos dados reais da planta para apoiar análises de frentes ativas, atrasos, demandas de insumos, riscos de cronograma e ordens de serviço. Como posso auxiliar seu turno hoje?",
  timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
};

/**
 * Decodifica o conteúdo bruto da mensagem extraindo referências visuais
 * estruturadas embutidas em <!--REFERENCES:...-->
 */
function parseMessageContent(rawContent: string): {
  cleanText: string;
  activities?: AttachedActivityData[];
  materials?: AttachedMaterialData[];
} {
  const match = rawContent.match(/<!--REFERENCES:([\s\S]*?)-->/);
  if (!match) {
    return { cleanText: rawContent };
  }

  const cleanText = rawContent.replace(match[0], "").trim();
  try {
    const parsed = JSON.parse(match[1]);
    return {
      cleanText,
      activities: Array.isArray(parsed.activities) ? parsed.activities : undefined,
      materials: Array.isArray(parsed.materials) ? parsed.materials : undefined,
    };
  } catch {
    return { cleanText };
  }
}

export function useIaChat() {
  const { user } = useAuth();
  const supabase = createClient();

  const [activeConversation, setActiveConversation] = useState<IaConversation | null>(null);
  const [messages, setMessages] = useState<IaChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeConversationRef = useRef<IaConversation | null>(null);

  // Mantém a ref sincronizada para uso dentro de closures assíncronas
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  /**
   * 1. Carregar a conversa ativa mais recente do usuário autenticado
   */
  const loadActiveConversation = useCallback(async () => {
    if (!user) {
      setIsInitializing(false);
      return;
    }

    try {
      setIsInitializing(true);
      const result = await getLatestActiveConversation(supabase, user.id);

      if (result && result.messages.length > 0) {
        setActiveConversation(result.conversation);

        // Mapeia mensagens do banco para formato de chat da interface
        const formatted: IaChatMessage[] = result.messages.map((m) => {
          const dateObj = new Date(m.createdAt);
          const timeStr = isNaN(dateObj.getTime())
            ? ""
            : dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

          const { cleanText, activities, materials } = parseMessageContent(m.content);

          return {
            id: m.id,
            sender: m.sender,
            text: cleanText,
            timestamp: timeStr,
            isStreaming: false,
            activity: activities && activities.length === 1 ? activities[0] : null,
            activities: activities && activities.length > 1 ? activities : undefined,
            material: materials && materials.length === 1 ? materials[0] : null,
            materials: materials && materials.length > 1 ? materials : undefined,
          };
        });

        setMessages(formatted);
      } else if (result && result.messages.length === 0) {
        setActiveConversation(result.conversation);
        setMessages([INITIAL_WELCOME_MESSAGE]);
      } else {
        setActiveConversation(null);
        setMessages([INITIAL_WELCOME_MESSAGE]);
      }
    } catch (err) {
      console.error("[useIaChat] Erro ao carregar histórico persistido:", err);
    } finally {
      setIsInitializing(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadActiveConversation();
  }, [loadActiveConversation]);

  /**
   * 2. Enviar mensagem com suporte a anexo de OS/Material, persistência e streaming
   */
  const sendMessage = useCallback(
    async (
      text: string,
      attachment?: { activity?: AttachedActivityData | null; material?: AttachedMaterialData | null }
    ) => {
      const trimmed = text.trim();
      const hasAttachment = Boolean(attachment?.activity || attachment?.material);

      if ((!trimmed && !hasAttachment) || isLoading || !user) return;

      setError(null);
      const userMsgId = `user-${Date.now()}`;
      const iaMsgId = `ia-${Date.now()}`;
      const timeNow = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const newUserMsg: IaChatMessage = {
        id: userMsgId,
        sender: "user",
        text: trimmed,
        timestamp: timeNow,
        activity: attachment?.activity || null,
        material: attachment?.material || null,
      };

      const initialIaMsg: IaChatMessage = {
        id: iaMsgId,
        sender: "ia",
        text: "",
        timestamp: timeNow,
        isStreaming: true,
      };

      // Atualização otimista na interface
      setMessages((prev) => [...prev, newUserMsg, initialIaMsg]);
      setIsLoading(true);

      abortControllerRef.current = new AbortController();

      try {
        // Garantir que existe uma conversa ativa no banco
        let currentConv = activeConversationRef.current;
        if (!currentConv) {
          const titleBase = trimmed || (attachment?.activity ? `OS ${attachment.activity.orderNumber}` : "Material");
          const initialTitle = titleBase.length > 45 ? `${titleBase.substring(0, 42)}...` : titleBase;
          currentConv = await createConversation(supabase, user.id, initialTitle);
          setActiveConversation(currentConv);
          activeConversationRef.current = currentConv;
        }

        // Serializa com metadados de anexo caso exista para salvar no banco
        let contentToPersist = trimmed;
        if (hasAttachment) {
          const refsJson = JSON.stringify({
            activities: attachment?.activity ? [attachment.activity] : undefined,
            materials: attachment?.material ? [attachment.material] : undefined,
          });
          contentToPersist = `${trimmed ? `${trimmed}\n` : ""}<!--REFERENCES:${refsJson}-->`;
        }

        // Persistir a mensagem do usuário no banco em background
        saveIaMessage(supabase, currentConv.id, "user", contentToPersist).catch((err) => {
          console.error("[useIaChat] Falha ao persistir mensagem do usuário:", err);
        });

        // Montar histórico recente para envio ao Gemini (últimas 10 mensagens)
        // Se houver anexo, enriquecemos o texto enviado ao modelo com o contexto estruturado da OS ou Material
        const payloadMessages = [...messages, newUserMsg].slice(-10).map((m) => {
          let promptText = m.text;
          if (m.activity) {
            promptText = `[Atividade Anexada pelo Usuário: OS ${m.activity.orderNumber} - "${m.activity.name}", Status: ${m.activity.status}, Progresso: ${m.activity.progressPercentage}%, Prazo: ${m.activity.plannedEndDate}${m.activity.assignedTo ? `, Responsável: ${m.activity.assignedTo}` : ""}]\n${promptText}`;
          } else if (m.material) {
            promptText = `[Material Anexado pelo Usuário: ${m.material.code} - "${m.material.name}", Saldo Físico: ${m.material.currentStock} ${m.material.unit}, Mínimo: ${m.material.minimumStock} ${m.material.unit}, Status: ${m.material.status}]\n${promptText}`;
          }
          return {
            sender: m.sender,
            text: promptText,
          };
        });

        const response = await fetch("/api/ia/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: payloadMessages,
            clientContext: {
              currentModule: "pintura/ia",
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          let errMsg = `Erro ${response.status}: Falha ao processar solicitação.`;
          try {
            const errData = await response.json();
            if (errData.error) errMsg = errData.error;
          } catch {
            // response não era JSON
          }
          throw new Error(errMsg);
        }

        if (!response.body) {
          throw new Error("Resposta vazia recebida do servidor.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;

          const { cleanText, activities, materials } = parseMessageContent(accumulatedText);

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === iaMsgId
                ? {
                    ...msg,
                    text: cleanText,
                    isStreaming: true,
                    activity: activities && activities.length === 1 ? activities[0] : null,
                    activities: activities && activities.length > 1 ? activities : undefined,
                    material: materials && materials.length === 1 ? materials[0] : null,
                    materials: materials && materials.length > 1 ? materials : undefined,
                  }
                : msg
            )
          );
        }

        // Finaliza o streaming na interface decodificando o texto e as entidades
        const finalParsed = parseMessageContent(accumulatedText);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === iaMsgId
              ? {
                  ...msg,
                  text: finalParsed.cleanText,
                  isStreaming: false,
                  activity: finalParsed.activities && finalParsed.activities.length === 1 ? finalParsed.activities[0] : null,
                  activities: finalParsed.activities && finalParsed.activities.length > 1 ? finalParsed.activities : undefined,
                  material: finalParsed.materials && finalParsed.materials.length === 1 ? finalParsed.materials[0] : null,
                  materials: finalParsed.materials && finalParsed.materials.length > 1 ? finalParsed.materials : undefined,
                }
              : msg
          )
        );

        // Persistir a resposta gerada pela IA no banco preservando o payload completo com metadados
        if (accumulatedText.trim() && currentConv) {
          await saveIaMessage(supabase, currentConv.id, "ia", accumulatedText);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          console.log("Geração cancelada pelo usuário.");
          return;
        }

        let msg = err instanceof Error ? err.message : "Erro de comunicação com o assistente de IA.";
        if (
          msg.toLowerCase().includes("failed to fetch") ||
          msg.toLowerCase().includes("network error") ||
          msg.toLowerCase().includes("networkerror")
        ) {
          msg = "Instabilidade temporária de conexão com o servidor. Por favor, tente novamente em instantes.";
        }
        setError(msg);

        // Atualiza mensagem da IA com o erro
        setMessages((prev) =>
          prev.map((m) => (m.id === iaMsgId ? { ...m, text: `⚠ ${msg}`, isStreaming: false } : m))
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isLoading, user, supabase]
  );

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  /**
   * 3. Excluir Mensagem Específica da Conversa
   */
  const deleteMessage = useCallback(
    async (messageId: string) => {
      // Remove otimista da UI
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      try {
        await deleteIaMessage(supabase, messageId);
      } catch (err) {
        console.error("[useIaChat] Erro ao deletar mensagem no banco:", err);
      }
    },
    [supabase]
  );

  /**
   * 4. Iniciar Nova Conversa
   */
  const clearChat = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const newConv = await createConversation(supabase, user.id, "Nova Conversa");
      setActiveConversation(newConv);
      activeConversationRef.current = newConv;
      setMessages([
        {
          id: `init-${Date.now()}`,
          sender: "ia",
          text: "Nova conversa iniciada. Os dados operacionais da planta continuam sincronizados em tempo real. Como posso auxiliar seu turno?",
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setError(null);
    } catch (err) {
      console.error("[useIaChat] Erro ao iniciar nova conversa:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    isInitializing,
    error,
    activeConversation,
    sendMessage,
    stopGeneration,
    deleteMessage,
    clearChat,
  };
}

