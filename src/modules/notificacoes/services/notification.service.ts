import { createClient } from "@/lib/supabase/client";
import { NotificationItem, NotificationCategory, NotificationSeverity } from "../types/notification.types";

interface SupabaseNotificationRow {
  id: string;
  event_key: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  link_href: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  notification_reads?: Array<{
    read_at: string;
  }> | null;
}

/**
 * Sincroniza ocorrências operacionais no Supabase via RPC atômica (idempotente).
 */
export async function syncOperationalNotifications(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("sync_operational_notifications");
  if (error) {
    console.warn("Aviso ao sincronizar notificações operacionais:", error.message);
  }
}

/**
 * Busca todas as notificações reais e o status de leitura do usuário autenticado.
 */
export async function getNotifications(): Promise<NotificationItem[]> {
  const supabase = createClient();

  // Executa uma sincronização leve antes de listar
  await syncOperationalNotifications();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select(`
      id,
      event_key,
      category,
      severity,
      title,
      message,
      link_href,
      entity_type,
      entity_id,
      created_at,
      notification_reads(read_at)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar notificações do Supabase:", error.message);
    throw new Error(error.message);
  }

  if (!data) return [];

  return (data as unknown as SupabaseNotificationRow[]).map((row) => {
    const isRead = !!(row.notification_reads && row.notification_reads.length > 0);
    const readAt = isRead ? row.notification_reads![0].read_at : null;

    return {
      id: row.id,
      eventKey: row.event_key,
      title: row.title,
      message: row.message,
      severity: row.severity as NotificationSeverity,
      category: row.category as NotificationCategory,
      linkHref: row.link_href,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
      read: isRead,
      readAt,
    };
  });
}

/**
 * Marca uma notificação individual como lida para o usuário autenticado.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuário não autenticado.");

  const { error } = await supabase
    .from("notification_reads")
    .insert({
      notification_id: notificationId,
      user_id: user.id,
    });

  if (error && error.code !== "23505") { // Ignora se já estiver lida (unique constraint)
    console.error("Erro ao marcar notificação como lida:", error.message);
    throw new Error(error.message);
  }
}

/**
 * Marca uma notificação individual como NÃO lida para o usuário autenticado.
 */
export async function markNotificationAsUnread(notificationId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuário não autenticado.");

  const { error } = await supabase
    .from("notification_reads")
    .delete()
    .eq("notification_id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Erro ao marcar notificação como não lida:", error.message);
    throw new Error(error.message);
  }
}

/**
 * Marca todas as notificações disponíveis como lidas via RPC segura.
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_all_notifications_as_read");

  if (error) {
    console.error("Erro ao marcar todas as notificações como lidas:", error.message);
    throw new Error(error.message);
  }
}
