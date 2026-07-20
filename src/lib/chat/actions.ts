import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChatMessage } from "@/lib/chat/types";

/**
 * Delete-for-me: hides a message from my own view only (message_hides).
 * Independent from delete-for-everyone (deleted_at, sender-only).
 */
export async function hideMessageForMe(
  supabase: SupabaseClient,
  messageId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("message_hides")
    .upsert({ message_id: messageId, user_id: userId });
  if (error) console.error("hideMessageForMe", error.message);
}

/** Pin a message to the top of the thread (shared between both participants). */
export async function pinMessage(
  supabase: SupabaseClient,
  conversationId: string,
  messageId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("conversation_pinned_messages")
    .upsert({
      conversation_id: conversationId,
      message_id: messageId,
      pinned_by: userId,
    });
  if (error) console.error("pinMessage", error.message);
}

export async function unpinMessage(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("conversation_pinned_messages")
    .delete()
    .eq("conversation_id", conversationId);
  if (error) console.error("unpinMessage", error.message);
}

export async function loadPinnedMessage(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ messageId: string; pinnedAt: string } | null> {
  const { data, error } = await supabase
    .from("conversation_pinned_messages")
    .select("message_id, pinned_at")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) {
    console.error("loadPinnedMessage", error.message);
    return null;
  }
  if (!data) return null;
  return { messageId: data.message_id, pinnedAt: data.pinned_at };
}

/**
 * Forward a message's content into another (existing) conversation.
 * No attribution to the source thread — matches WhatsApp's own
 * forward semantics. Media is referenced by re-inserting attachment
 * rows against the same storage_path (no re-upload needed; RLS on
 * chat-media only cares about the uploader's folder prefix, which is
 * unaffected because we don't touch storage.objects here).
 */
export async function forwardMessage(
  supabase: SupabaseClient,
  message: ChatMessage,
  targetConversationId: string,
  senderId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: targetConversationId,
      sender_id: senderId,
      body: message.body,
      message_type: message.message_type,
      reply_to_id: null,
      forwarded: true,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Falha ao reencaminhar." };
  }

  if (message.attachments.length) {
    const rows = message.attachments.map((att) => ({
      message_id: inserted.id,
      storage_path: att.storage_path,
      mime_type: att.mime_type,
      file_name: att.file_name,
      size_bytes: att.size_bytes,
      kind: att.kind,
    }));
    const { error: attErr } = await supabase
      .from("message_attachments")
      .insert(rows);
    if (attErr) {
      console.error("forwardMessage attachments", attErr.message);
    }
  }

  return { ok: true, id: inserted.id as string };
}

/** Search message bodies within a single thread ("jump to message"). */
export async function searchMessagesInConversation(
  supabase: SupabaseClient,
  conversationId: string,
  query: string,
  limit = 30,
): Promise<Pick<ChatMessage, "id" | "body" | "created_at" | "sender_id">[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("id, body, created_at, sender_id")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .ilike("body", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("searchMessagesInConversation", error.message);
    return [];
  }
  return data ?? [];
}
