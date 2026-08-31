import { ActivityStatus, ActivityPriority } from "@/modules/atividades/types/activity.types";
import { MaterialStockStatus } from "@/modules/materiais/types/material.types";

export interface ChatUserSummary {
  id: string;
  fullName: string;
  role: string;
  email?: string;
}

export interface AttachedActivityData {
  id: string;
  orderNumber: string;
  name: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  progressPercentage: number;
  plannedEndDate: string;
  areaName?: string;
  assignedTo?: string;
}

export interface AttachedMaterialData {
  id: string;
  code: string;
  name: string;
  type: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  status: MaterialStockStatus;
}

export interface ChatMessage {
  id: string;
  userId: string;
  content: string | null;
  activityId: string | null;
  materialId: string | null;
  imageUrl?: string | null;
  imageName?: string | null;
  createdAt: string;
  updatedAt: string;
  user: ChatUserSummary;
  activity?: AttachedActivityData | null;
  material?: AttachedMaterialData | null;
  isActivityDeleted?: boolean;
  isMaterialDeleted?: boolean;
}

export interface OnlineUserPresence {
  userId: string;
  fullName: string;
  role: string;
  onlineAt: string;
}

export interface SendMessageInput {
  content?: string;
  activityId?: string;
  materialId?: string;
  imageUrl?: string;
  imageName?: string;
}
