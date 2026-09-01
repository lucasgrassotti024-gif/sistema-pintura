import { SupabaseClient } from "@supabase/supabase-js";
import { IaConversation, IaDbMessage } from "../types/ia.types";

/**
 * Serviço de Persistência de Conversas e Mensagens da IA.
 * Executado sob a sessão autenticada do Supabase (respeitando 100% o RLS).
 */

export async function getLatestActiveConversation(
  supabase: SupabaseClient,
  userId: string
): Promise<{ conversation: IaConversation; messages: IaDbMessage[] } | null> {
  // 1. Buscar a conversa mais recente do usuário autenticado
  const { data: convData, error: convError } = await supabase
    .from("ia_conversations")
    .select("id, user_id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (convError || !convData) {
    if (convError) {
      console.error("[IaConversationService] Erro ao buscar conversa recente:", convError.message);
    }
    return null;
  }

  const conversation: IaConversation = {
    id: convData.id,
    userId: convData.user_id,
    title: convData.title,
    createdAt: convData.created_at,
    updatedAt: convData.updated_at,
  };

  // 2. Buscar as mensagens dessa conversa ordenadas cronologicamente
  const { data: msgData, error: msgError } = await supabase
    .from("ia_messages")
    .select("id, conversation_id, sender, content, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("[IaConversationService] Erro ao buscar mensagens da conversa:", msgError.message);
    return { conversation, messages: [] };
  }

  const messages: IaDbMessage[] = (msgData || []).map((m: any) => ({
    id: m.id,
    conversationId: m.conversation_id,
    sender: m.sender,
    content: m.content,
    createdAt: m.created_at,
  }));

  return { conversation, messages };
}

export async function createConversation(
  supabase: SupabaseClient,
  userId: string,
  title: string = "Conversa com Assistente"
): Promise<IaConversation> {
  const { data, error } = await supabase
    .from("ia_conversations")
    .insert({
      user_id: userId,
      title,
    })
    .select("id, user_id, title, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar nova conversa de IA: ${error?.message || "Erro desconhecido"}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function saveIaMessage(
  supabase: SupabaseClient,
  conversationId: string,
  sender: "user" | "ia",
  content: string
): Promise<IaDbMessage> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Não é possível salvar uma mensagem vazia.");
  }

  // 1. Inserir a mensagem
  const { data, error } = await supabase
    .from("ia_messages")
    .insert({
      conversation_id: conversationId,
      sender,
      content: trimmed,
    })
    .select("id, conversation_id, sender, content, created_at")
    .single();

  if (error || !data) {
    throw new Error(`Falha ao persistir mensagem da IA: ${error?.message || "Erro desconhecido"}`);
  }

  // 2. Atualizar o timestamp updated_at da conversa (disparo não bloqueante)
  supabase
    .from("ia_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .then(({ error: updateErr }) => {
      if (updateErr) {
        console.warn("[IaConversationService] Aviso ao atualizar timestamp da conversa:", updateErr.message);
      }
    });

  return {
    id: data.id,
    conversationId: data.conversation_id,
    sender: data.sender,
    content: data.content,
    createdAt: data.created_at,
  };
}
