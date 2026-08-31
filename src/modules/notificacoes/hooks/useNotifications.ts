"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { NotificationItem, NotificationCategory } from "../types/notification.types";
import {
  getNotifications,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  syncOperationalNotifications,
} from "../services/notification.service";
import { createClient } from "@/lib/supabase/client";

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [readFilter, setReadFilter] = useState<"todas" | "nao_lidas">("todas");
  const [categoryFilter, setCategoryFilter] = useState<"todas" | NotificationCategory>("todas");

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar notificações do Supabase.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // ----------------------------------------------------------------------------
  // Sincronização em Tempo Real (Supabase Realtime)
  // ----------------------------------------------------------------------------
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("realtime-notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        async () => {
          // Atualiza lista preservando status de leitura
          try {
            const data = await getNotifications();
            setNotifications(data);
          } catch (err) {
            console.warn("Aviso ao recarregar notificações via Realtime:", err);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notification_reads",
        },
        async () => {
          try {
            const data = await getNotifications();
            setNotifications(data);
          } catch (err) {
            console.warn("Aviso ao sincronizar status de leituras via Realtime:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Ações de Leitura
  const markAsRead = async (id: string) => {
    // Atualização otimista
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
    );
    try {
      await markNotificationAsRead(id);
    } catch (err) {
      console.error("Falha ao persistir marcação de lida:", err);
      // Reverter se falhar
      loadNotifications();
    }
  };

  const markAsUnread = async (id: string) => {
    // Atualização otimista
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: false, readAt: null } : n))
    );
    try {
      await markNotificationAsUnread(id);
    } catch (err) {
      console.error("Falha ao persistir desmarcação de leitura:", err);
      loadNotifications();
    }
  };

  const markAllAsRead = async () => {
    // Atualização otimista
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
    );
    try {
      await markAllNotificationsAsRead();
    } catch (err) {
      console.error("Falha ao marcar todas como lidas:", err);
      loadNotifications();
    }
  };

  // Contadores
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Lista Filtrada
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (readFilter === "nao_lidas" && item.read) return false;
      if (categoryFilter !== "todas" && item.category !== categoryFilter) return false;
      return true;
    });
  }, [notifications, readFilter, categoryFilter]);

  return {
    notifications,
    filteredNotifications,
    unreadCount,
    isLoading,
    error,
    readFilter,
    setReadFilter,
    categoryFilter,
    setCategoryFilter,
    refreshNotifications: loadNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
  };
}
