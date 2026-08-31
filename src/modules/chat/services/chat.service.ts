import { createClient } from "@/lib/supabase/client";
import {
  ChatMessage,
  SendMessageInput,
  AttachedActivityData,
  AttachedMaterialData,
} from "../types/chat.types";
import { calculateStockStatus } from "@/modules/materiais/rules/material.rules";
import { ActivityStatus, ActivityPriority } from "@/modules/atividades/types/activity.types";

interface DbChatMessageRow {
  id: string;
  user_id: string;
  content: string | null;
  activity_id: string | null;
  material_id: string | null;
  image_url?: string | null;
  image_name?: string | null;
  created_at: string;
  updated_at: string;
  users?: {
    id: string;
    full_name: string;
    role: string;
    email: string;
  } | null;
  activities?: {
    id: string;
    order_number: string;
    name: string;
    status: string;
    priority: string;
    progress_percentage: number;
    planned_end_date: string;
    areas?: { name: string } | null;
    users?: { full_name: string } | null;
  } | null;
  materials?: {
    id: string;
    code: string;
    name: string;
    type: string;
    unit: string;
    current_stock: number;
    minimum_stock: number;
  } | null;
}

function mapRowToChatMessage(row: DbChatMessageRow): ChatMessage {
  let attachedActivity: AttachedActivityData | null = null;
  let isActivityDeleted = false;

  if (row.activity_id) {
    if (row.activities) {
      attachedActivity = {
        id: row.activities.id,
        orderNumber: row.activities.order_number,
        name: row.activities.name,
        status: (row.activities.status || "programada") as ActivityStatus,
        priority: (row.activities.priority || "media") as ActivityPriority,
        progressPercentage: Number(row.activities.progress_percentage || 0),
        plannedEndDate: row.activities.planned_end_date,
        areaName: row.activities.areas?.name,
        assignedTo: row.activities.users?.full_name,
      };
    } else {
      isActivityDeleted = true;
    }
  }

  let attachedMaterial: AttachedMaterialData | null = null;
  let isMaterialDeleted = false;

  if (row.material_id) {
    if (row.materials) {
      const cur = Number(row.materials.current_stock || 0);
      const min = Number(row.materials.minimum_stock || 0);
      attachedMaterial = {
        id: row.materials.id,
        code: row.materials.code,
        name: row.materials.name,
        type: row.materials.type,
        unit: row.materials.unit,
        currentStock: cur,
        minimumStock: min,
        status: calculateStockStatus(cur, min),
      };
    } else {
      isMaterialDeleted = true;
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    activityId: row.activity_id,
    materialId: row.material_id,
    imageUrl: row.image_url || null,
    imageName: row.image_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: row.users?.id || row.user_id,
      fullName: row.users?.full_name || "Operador",
      role: row.users?.role || "operador",
      email: row.users?.email,
    },
    activity: attachedActivity,
    material: attachedMaterial,
    isActivityDeleted,
    isMaterialDeleted,
  };
}

/**
 * Faz o upload de uma imagem do chat para o Supabase Storage de forma segura.
 */
export async function uploadChatImage(file: File): Promise<{ url: string; fileName: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado para upload de imagem.");
  }

  // Validação de tipo de arquivo
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimes.includes(file.type)) {
    throw new Error("Formato de imagem inválido. Use JPG, PNG ou WEBP.");
  }

  // Validação de tamanho (máximo 5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("A imagem não pode ultrapassar 5 MB.");
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const photoId = crypto.randomUUID();
  const filePath = `${user.id}/${photoId}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("chat-attachments")
    .upload(filePath, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    console.error("[uploadChatImage] Erro ao enviar imagem ao Storage:", uploadError);
    throw new Error(`Falha no upload da foto: ${uploadError.message}`);
  }

  const { data: publicData } = supabase.storage
    .from("chat-attachments")
    .getPublicUrl(filePath);

  return {
    url: publicData.publicUrl,
    fileName: file.name,
  };
}

/**
 * Carrega a lista de mensagens do Chat da Operação em ordem cronológica com relacionamentos.
 */
export async function getChatMessages(): Promise<ChatMessage[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("operation_chat_messages")
    .select(`
      id,
      user_id,
      content,
      activity_id,
      material_id,
      image_url,
      image_name,
      created_at,
      updated_at,
      users (id, full_name, role, email),
      activities (
        id,
        order_number,
        name,
        status,
        priority,
        progress_percentage,
        planned_end_date,
        areas (name),
        users!activities_assigned_user_id_fkey (full_name)
      ),
      materials (
        id,
        code,
        name,
        type,
        unit,
        current_stock,
        minimum_stock
      )
    `)
    .order("created_at", { ascending: true })
    .limit(150);

  if (error) {
    console.error("[getChatMessages] Erro ao carregar mensagens:", error);
    throw new Error(`Falha ao carregar mensagens do chat: ${error.message}`);
  }

  return (data as unknown as DbChatMessageRow[] || []).map(mapRowToChatMessage);
}

/**
 * Busca uma única mensagem pelo ID com todos os relacionamentos completos.
 */
export async function getChatMessageById(messageId: string): Promise<ChatMessage | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("operation_chat_messages")
    .select(`
      id,
      user_id,
      content,
      activity_id,
      material_id,
      image_url,
      image_name,
      created_at,
      updated_at,
      users (id, full_name, role, email),
      activities (
        id,
        order_number,
        name,
        status,
        priority,
        progress_percentage,
        planned_end_date,
        areas (name),
        users!activities_assigned_user_id_fkey (full_name)
      ),
      materials (
        id,
        code,
        name,
        type,
        unit,
        current_stock,
        minimum_stock
      )
    `)
    .eq("id", messageId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRowToChatMessage(data as unknown as DbChatMessageRow);
}

/**
 * Envia uma nova mensagem no chat operacional sob autenticação do usuário.
 */
export async function sendChatMessage(input: SendMessageInput): Promise<ChatMessage> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Você precisa estar autenticado para enviar mensagens no chat.");
  }

  const { data, error } = await supabase
    .from("operation_chat_messages")
    .insert({
      user_id: user.id,
      content: input.content?.trim() || null,
      activity_id: input.activityId || null,
      material_id: input.materialId || null,
      image_url: input.imageUrl?.trim() || null,
      image_name: input.imageName?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[sendChatMessage] Erro ao inserir mensagem:", error);
    throw new Error(`Erro ao enviar mensagem: ${error.message}`);
  }

  const persisted = await getChatMessageById(data.id);
  if (!persisted) {
    throw new Error("Falha ao recuperar a mensagem enviada do banco.");
  }

  return persisted;
}

/**
 * Exclui uma mensagem do próprio autor (protegido por RLS).
 */
export async function deleteChatMessage(messageId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("operation_chat_messages")
    .delete()
    .eq("id", messageId);

  if (error) {
    console.error("[deleteChatMessage] Erro ao excluir mensagem:", error);
    throw new Error(`Erro ao excluir mensagem: ${error.message}`);
  }
}
