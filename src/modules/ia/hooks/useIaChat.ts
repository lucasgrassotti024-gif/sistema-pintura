"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { IaChatMessage, IaConversation } from "../types/ia.types";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  getLatestActiveConversation,
  createConversation,
  saveIaMessage,
} from "../services/ia-conversation.service";

const INITIAL_WELCOME_MESSAGE: IaChatMessage = {
  id: "init-welcome",
  sender: "ia",
  text: "Olá! Sou o Assistente Operacional de Engenharia do Sistema de Pintura Industrial. Estou conectado aos dados reais da planta para apoiar análises de frentes ativas, atrasos, demandas de insumos, riscos de cronograma e ordens de serviço. Como posso auxiliar seu turno hoje?",
  timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
};

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

          return {
            id: m.id,
            sender: m.sender,
            text: m.content,
            timestamp: timeStr,
            isStreaming: false,
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
   * 2. Enviar mensagem com persistência imediata e streaming
   */
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || !user) return;

      setError(null);
      const userMsgId = `user-${Date.now()}`;
      const iaMsgId = `ia-${Date.now()}`;
      const timeNow = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const newUserMsg: IaChatMessage = {
        id: userMsgId,
        sender: "user",
        text: trimmed,
        timestamp: timeNow,
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
          const initialTitle = trimmed.length > 45 ? `${trimmed.substring(0, 42)}...` : trimmed;
          currentConv = await createConversation(supabase, user.id, initialTitle);
          setActiveConversation(currentConv);
          activeConversationRef.current = currentConv;
        }

        // Persistir a mensagem do usuário no banco em background
        saveIaMessage(supabase, currentConv.id, "user", trimmed).catch((err) => {
          console.error("[useIaChat] Falha ao persistir mensagem do usuário:", err);
        });

        // Montar histórico recente para envio ao Gemini (últimas 10 mensagens)
        const payloadMessages = [...messages, newUserMsg].slice(-10).map((m) => ({
          sender: m.sender,
          text: m.text,
        }));

        const response = await fetch("/api/ia/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payloadMessages }),
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

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === iaMsgId ? { ...msg, text: accumulatedText, isStreaming: true } : msg
            )
          );
        }

        // Finaliza o streaming na interface
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === iaMsgId ? { ...msg, text: accumulatedText, isStreaming: false } : msg
          )
        );

        // Persistir a resposta gerada pela IA no banco
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
   * 3. Iniciar Nova Conversa
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
    clearChat,
  };
}
