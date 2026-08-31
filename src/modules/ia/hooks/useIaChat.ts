"use client";

import { useState, useCallback, useRef } from "react";
import { IaChatMessage } from "../types/ia.types";

export function useIaChat() {
  const [messages, setMessages] = useState<IaChatMessage[]>([
    {
      id: "init-1",
      sender: "ia",
      text: "Olá! Sou o Assistente Operacional de Engenharia do Sistema de Pintura Industrial. Estou conectado aos dados reais da planta para apoiar análises de frentes ativas, atrasos, demandas de insumos, riscos de cronograma e ordens de serviço. Como posso auxiliar seu turno hoje?",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

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

      setMessages((prev) => [...prev, newUserMsg, initialIaMsg]);
      setIsLoading(true);

      abortControllerRef.current = new AbortController();

      try {
        const payloadMessages = [...messages, newUserMsg].map((m) => ({
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

        // Finaliza o streaming
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === iaMsgId ? { ...msg, text: accumulatedText, isStreaming: false } : msg
          )
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          console.log("Geração cancelada pelo usuário.");
          return;
        }

        const msg = err instanceof Error ? err.message : "Erro de comunicação com o assistente de IA.";
        setError(msg);

        // Remove a mensagem da IA se estiver vazia
        setMessages((prev) =>
          prev
            .map((m) => (m.id === iaMsgId ? { ...m, text: `⚠ ${msg}`, isStreaming: false } : m))
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isLoading]
  );

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "init-1",
        sender: "ia",
        text: "Conversa reiniciada. Os dados operacionais da planta continuam sincronizados em tempo real. Como posso ajudar agora?",
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setError(null);
  };

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    stopGeneration,
    clearChat,
  };
}
