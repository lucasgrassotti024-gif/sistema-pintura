"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { NotificationItem, NotificationCategory } from "../types/notification.types";
import { notificationRepository } from "../repositories/notification.repository";
import { createClient } from "@/lib/supabase/client";
import { realtimeReconciler } from "@/lib/offline/realtime-reconciler.service";

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
      const data = await notificationRepository.getNotifications();
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
  // Sincronização em Tempo Real (Supabase Realtime) via Reconciliador Central
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
        async (payload) => {
          try {
            if (payload.eventType === "INSERT") {
              const row = payload.new as any;
              const notif: NotificationItem = {
                id: row.id,
                eventKey: row.event_key,
                title: row.title,
                message: row.message,
                severity: row.severity,
                category: row.category,
                linkHref: row.link_href,
                entityType: row.entity_type,
                entityId: row.entity_id,
                createdAt: row.created_at,
                read: false,
                readAt: null,
              };

              const res = await realtimeReconciler.reconcileNotificationUpsert(notif);
              if (res.applied) {
                setNotifications((prev) => {
                  if (prev.some((n) => n.id === notif.id)) return prev;
                  return [notif, ...prev];
                });
              }
            } else if (payload.eventType === "UPDATE") {
              const row = payload.new as any;
              const notif: NotificationItem = {
                id: row.id,
                eventKey: row.event_key,
                title: row.title,
                message: row.message,
                severity: row.severity,
                category: row.category,
                linkHref: row.link_href,
                entityType: row.entity_type,
                entityId: row.entity_id,
                createdAt: row.created_at,
                read: false,
                readAt: null,
              };

              const res = await realtimeReconciler.reconcileNotificationUpsert(notif);
              if (res.applied) {
                setNotifications((prev) =>
                  prev.map((n) => (n.id === notif.id ? { ...n, ...notif, read: n.read, readAt: n.readAt } : n))
                );
              }
            } else if (payload.eventType === "DELETE") {
              const deletedId = (payload.old as { id: string }).id;
              const res = await realtimeReconciler.reconcileNotificationDelete(deletedId);
              if (res.applied) {
                setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
              }
            }
          } catch (err) {
            console.warn("Aviso ao reconciliar notificação via Realtime:", err);
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
        async (payload) => {
          try {
            if (payload.eventType === "INSERT") {
              const readRow = payload.new as { notification_id: string; read_at: string };
              const notifId = readRow.notification_id;
              const res = await realtimeReconciler.reconcileNotificationReadStatus(notifId, true, readRow.read_at);
              if (res.applied) {
                setNotifications((prev) =>
                  prev.map((n) => (n.id === notifId ? { ...n, read: true, readAt: readRow.read_at } : n))
                );
              }
            } else if (payload.eventType === "DELETE") {
              const unreadRow = payload.old as { notification_id: string };
              const notifId = unreadRow.notification_id;
              const res = await realtimeReconciler.reconcileNotificationReadStatus(notifId, false, null);
              if (res.applied) {
                setNotifications((prev) =>
                  prev.map((n) => (n.id === notifId ? { ...n, read: false, readAt: null } : n))
                );
              }
            }
          } catch (err) {
            console.warn("Aviso ao reconciliar status de leitura via Realtime:", err);
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
      await notificationRepository.markNotificationAsRead(id);
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
      await notificationRepository.markNotificationAsUnread(id);
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
      await notificationRepository.markAllNotificationsAsRead();
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
