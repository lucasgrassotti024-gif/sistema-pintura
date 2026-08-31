"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChatMessage,
  SendMessageInput,
  OnlineUserPresence,
  AttachedActivityData,
  AttachedMaterialData,
} from "../types/chat.types";
import {
  getChatMessages,
  getChatMessageById,
  sendChatMessage as sendChatMessageService,
  deleteChatMessage as deleteChatMessageService,
} from "../services/chat.service";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

export function useChat() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserPresence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Carregamento Inicial das Mensagens
  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getChatMessages();
      setMessages(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar mensagens do chat.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // 2. Realtime & Presença Integrados via Supabase Channel
  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    const channelName = "realtime:operation_chat";

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    // Escuta novas mensagens e exclusões
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "operation_chat_messages",
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newId = (payload.new as { id: string }).id;
            const fullMessage = await getChatMessageById(newId);
            if (fullMessage) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === fullMessage.id)) return prev;
                return [...prev, fullMessage];
              });
            }
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setMessages((prev) => prev.filter((m) => m.id !== deletedId));
          }
        }
      )
      // Presença de Usuários Online
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const usersList: OnlineUserPresence[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key] as unknown as OnlineUserPresence[];
          if (presences && presences.length > 0) {
            usersList.push(presences[0]);
          }
        });

        setOnlineUsers(usersList);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: user.id,
            fullName: profile?.fullName || user.email?.split("@")[0] || "Operador",
            role: profile?.role || "operador",
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  // 3. Enviar Mensagem
  const sendMessage = async (input: SendMessageInput) => {
    setIsSending(true);
    setError(null);
    try {
      const persisted = await sendChatMessageService(input);
      setMessages((prev) => {
        if (prev.some((m) => m.id === persisted.id)) return prev;
        return [...prev, persisted];
      });
      return persisted;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar mensagem.";
      setError(msg);
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  // 4. Excluir Mensagem
  const deleteMessage = async (messageId: string) => {
    try {
      await deleteChatMessageService(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir mensagem.";
      setError(msg);
      throw err;
    }
  };

  // 5. Contexto Agregado da Sala (Atividades e Materiais mencionados na conversa)
  const roomContext = useMemo(() => {
    const activitiesMap = new Map<string, AttachedActivityData>();
    const materialsMap = new Map<string, AttachedMaterialData>();

    messages.forEach((msg) => {
      if (msg.activity && !msg.isActivityDeleted) {
        activitiesMap.set(msg.activity.id, msg.activity);
      }
      if (msg.material && !msg.isMaterialDeleted) {
        materialsMap.set(msg.material.id, msg.material);
      }
    });

    return {
      activities: Array.from(activitiesMap.values()),
      materials: Array.from(materialsMap.values()),
    };
  }, [messages]);

  return {
    messages,
    onlineUsers,
    isLoading,
    isSending,
    error,
    roomContext,
    sendMessage,
    deleteMessage,
    refreshMessages: loadMessages,
  };
}
