export type NotificationSeverity = "info" | "alerta" | "urgente";
export type NotificationCategory = "atividades" | "estoque" | "sistema";

export interface NotificationItem {
  id: string;
  eventKey: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  linkHref?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
  read: boolean;
  readAt?: string | null;
}
