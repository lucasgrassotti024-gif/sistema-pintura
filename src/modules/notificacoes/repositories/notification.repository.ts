import { NotificationItem } from "../types/notification.types";
import {
  getNotifications,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  syncOperationalNotifications,
} from "../services/notification.service";

/**
 * Contrato de repositório para o domínio de Notificações.
 * Isola a interface das chamadas diretas ao Supabase e RPCs de notificação.
 */
export interface INotificationRepository {
  getNotifications(): Promise<NotificationItem[]>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markNotificationAsUnread(notificationId: string): Promise<void>;
  markAllNotificationsAsRead(): Promise<void>;
  syncOperationalNotifications(): Promise<void>;
}

import {
  cacheNotificationsLocally,
  getLocalNotifications,
  isNetworkOrOfflineError,
  isBrowserOnline,
} from "@/lib/offline";

/**
 * Implementação do INotificationRepository com suporte a Cache Local e Leitura Offline (IndexedDB/Dexie).
 * ONLINE: consulta o Supabase e atualiza o cache local.
 * OFFLINE / ERRO DE REDE: exibe as últimas notificações conhecidas armazenadas localmente.
 */
export class SupabaseNotificationRepository implements INotificationRepository {
  async getNotifications(): Promise<NotificationItem[]> {
    if (!isBrowserOnline()) {
      const local = await getLocalNotifications();
      if (local.length > 0) return local;
    }

    try {
      const data = await getNotifications();
      cacheNotificationsLocally(data).catch((err) =>
        console.warn("[notificationRepository] Aviso ao gravar cache de notificações:", err)
      );
      return data;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn("[notificationRepository] Rede indisponível. Recorrendo ao cache local de notificações.");
        const local = await getLocalNotifications();
        if (local.length > 0) {
          return local;
        }
      }
      throw err;
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    return markNotificationAsRead(notificationId);
  }

  async markNotificationAsUnread(notificationId: string): Promise<void> {
    return markNotificationAsUnread(notificationId);
  }

  async markAllNotificationsAsRead(): Promise<void> {
    return markAllNotificationsAsRead();
  }

  async syncOperationalNotifications(): Promise<void> {
    return syncOperationalNotifications();
  }
}

/**
 * Instância padrão do repositório de notificações.
 */
export const notificationRepository: INotificationRepository = new SupabaseNotificationRepository();
