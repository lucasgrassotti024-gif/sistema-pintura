"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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

// Timestamp estático inicial para evitar qualquer discrepância de hidratação entre SSR e Client
const INITIAL_WELCOME_MESSAGE: IaChatMessage = {
  id: "init-welcome",
  sender: "ia",
  text: "Olá! Sou o Assistente Operacional de Engenharia do Sistema de Pintura Industrial. Estou conectado aos dados reais da planta para apoiar análises de frentes ativas, atrasos, demandas de insumos, riscos de cronograma e ordens de serviço. Como posso auxiliar seu turno hoje?",
  timestamp: "--:--",
};

/**
 * Decodifica o conteúdo bruto da mensagem extraindo referências visuais
 * estruturadas embutidas em <!--REFERENCES:...-->.
 * Trata com resiliência:
 * - Mensagens sem referências
 * - Fragmentos parciais recebidos durante o streaming SSE (ex: "<!--REF" ou "<!--REFERENCES:{" )
 * - JSON inválido ou corrompido
 * - Referências vazias ou dados malformados
 */
function parseMessageContent(rawContent: string): {
  cleanText: string;
  activities?: AttachedActivityData[];
  materials?: AttachedMaterialData[];
} {
  if (!rawContent) {
    return { cleanText: "" };
  }

  // Se a tag foi aberta mas ainda não fechou durante o streaming progressivo,
  // removemos o trecho parcial da exibição de texto para não poluir o chat,
  // mas NÃO tentamos executar JSON.parse prematuramente.
  const partialIndex = rawContent.indexOf("<!--REFERENCES:");
  if (partialIndex !== -1 && !rawContent.includes("-->")) {
    return { cleanText: rawContent.substring(0, partialIndex).trimEnd() };
  }

  // Também trata se estiver no início de abertura parcial (ex: "<!--REF")
  const openTagPartial = rawContent.search(/<!--(?:R(?:E(?:F(?:E(?:R(?:E(?:N(?:C(?:E(?:S)?)?)?)?)?)?)?)?)?)?$/i);
  if (openTagPartial !== -1 && openTagPartial > 0) {
    return { cleanText: rawContent.substring(0, openTagPartial).trimEnd() };
  }

  const match = rawContent.match(/<!--REFERENCES:([\s\S]*?)-->/);
  if (!match) {
    return { cleanText: rawContent };
  }

  const cleanText = rawContent.replace(match[0], "").trimEnd();
  const rawJson = match[1]?.trim();

  if (!rawJson) {
    return { cleanText };
  }

  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== "object") {
      return { cleanText };
    }

    const activities = Array.isArray(parsed.activities)
      ? parsed.activities.filter((a: any) => a && typeof a === "object" && a.id)
      : undefined;

    const materials = Array.isArray(parsed.materials)
      ? parsed.materials.filter((m: any) => m && typeof m === "object" && m.id)
      : undefined;

    return {
      cleanText,
      activities: activities && activities.length > 0 ? activities : undefined,
      materials: materials && materials.length > 0 ? materials : undefined,
    };
  } catch {
    // Se o JSON estiver incompleto ou inválido, retorna apenas o texto limpo sem derrubar a tela
    return { cleanText };
  }
}

export function useIaChat() {
  const { user, isLoading: authLoading } = useAuth();

  // 1. Instância singleton estável do cliente Supabase para o Browser (evita re-instanciação a cada render)
  const supabase = useMemo(() => createClient(), []);

  const [activeConversation, setActiveConversation] = useState<IaConversation | null>(null);
  const [messages, setMessages] = useState<IaChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeConversationRef = useRef<IaConversation | null>(null);

  // Ajusta o timestamp da mensagem inicial amigavelmente no client após a montagem (sem hydration mismatch)
  useEffect(() => {
    const currentTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) =>
      prev.map((m) => (m.id === "init-welcome" && m.timestamp === "--:--" ? { ...m, timestamp: currentTime } : m))
    );
  }, []);

  // Mantém a ref sincronizada para uso dentro de closures assíncronas
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  /**
   * 1. Carregar a conversa ativa mais recente do usuário autenticado em background
   * NUNCA bloqueia a interface do chat: o chat permanece pronto para digitação imediatamente.
   */
  const loadActiveConversation = useCallback(async () => {
    // Se a autenticação ainda estiver carregando, aguarda
    if (authLoading) return;

    // Se não há usuário autenticado após carregar o auth, finaliza
    if (!user) {
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);

    // Timeout de segurança defensivo (4s) para NUNCA prender a UI
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 4000);
    });

    try {
      const fetchPromise = getLatestActiveConversation(supabase, user.id);
      const result = await Promise.race([fetchPromise, timeoutPromise]);

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
      }
    } catch (err) {
      console.warn("[useIaChat] Aviso ao carregar histórico em segundo plano:", err);
    } finally {
      setIsInitializing(false);
    }
  }, [user, authLoading, supabase]);

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

