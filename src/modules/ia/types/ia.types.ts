export type IaIntentType =
  | "panorama"
  | "atividades"
  | "atrasos"
  | "prazos"
  | "estoque"
  | "materiais"
  | "consumo"
  | "atividade_especifica"
  | "riscos_operacionais";

export interface IaRouterResult {
  intent: IaIntentType;
  orderNumber?: string;
  materialCode?: string;
  matchedKeywords: string[];
}

export interface IaConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface IaDbMessage {
  id: string;
  conversationId: string;
  sender: "user" | "ia";
  content: string;
  createdAt: string;
}

export interface IaChatMessage {
  id: string;
  sender: "user" | "ia";
  text: string;
  timestamp: string;
  isStreaming?: boolean;
}

export interface ActivitySnapshotItem {
  id: string;
  order_number: string;
  name: string;
  status: string;
  priority: string;
  progress_percentage: number;
  planned_start_date: string;
  planned_end_date: string;
  area_name?: string;
  location_name?: string;
  equipment_name?: string;
  assigned_user_name?: string;
  team_name?: string;
  cancellation_reason?: string;
  planned_materials?: Array<{
    name: string;
    planned_qty: number;
    unit: string;
  }>;
  recent_consumptions?: Array<{
    material_name: string;
    qty: number;
    unit: string;
  }>;
}

export interface MaterialSnapshotItem {
  id: string;
  code: string;
  name: string;
  type: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  status: "adequado" | "atencao" | "critico";
  location?: string;
}

export interface NotificationSnapshotItem {
  severity: string;
  title: string;
  message: string;
  created_at: string;
}

export interface OperationalSnapshot {
  timestamp: string;
  intent: IaIntentType;
  specific_target?: string;
  summary: {
    total_active_os: number;
    delayed_os_count: number;
    due_soon_os_count: number;
    critical_materials_count: number;
  };
  activities?: ActivitySnapshotItem[];
  materials?: MaterialSnapshotItem[];
  notifications?: NotificationSnapshotItem[];
  disclaimer?: string;
}
