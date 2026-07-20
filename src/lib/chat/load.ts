import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChatAttachment, ChatMessage, MessageType } from "@/lib/chat/types";
import { signedChatUrls } from "@/lib/posts/media";

/** First paint: last N messages. Older via loadConversationMessages before= */
export const CHAT_PAGE_SIZE = 50;

/**
 * Load thread messages with attachments + reactions.
 * Batch-signed media; default = most recent page (native chat feel).
 */
export async function loadConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  opts?: { limit?: number; before?: string; userId?: string },
): Promise<ChatMessage[]> {
  const limit = opts?.limit ?? CHAT_PAGE_SIZE;

  let query = supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, body, message_type, reply_to_id, deleted_at, created_at, forwarded",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.before) {
    query = query.lt("created_at", opts.before);
  }

  const { data: raw, error } = await query;

  if (error) {
    console.error("loadConversationMessages", error.message);
    return [];
  }
  if (!raw?.length) return [];

  type MsgRow = {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string | null;
    message_type: MessageType | null;
    reply_to_id: string | null;
    deleted_at: string | null;
    created_at: string;
    forwarded: boolean | null;
  };

  // Chronological order for UI
  let list = ([...raw] as MsgRow[]).reverse();

  // "Apagar para mim": drop messages I've individually hidden, without
  // touching the sender's copy or the other participant's view.
  if (opts?.userId) {
    const { data: hidden, error: hideErr } = await supabase
      .from("message_hides")
      .select("message_id")
      .eq("user_id", opts.userId)
      .in(
        "message_id",
        list.map((m) => m.id),
      );
    if (hideErr) {
      console.error("loadConversationMessages hides", hideErr.message);
    } else if (hidden?.length) {
      const hiddenIds = new Set(hidden.map((h) => h.message_id));
      list = list.filter((m) => !hiddenIds.has(m.id));
    }
  }

  const ids = list.map((m) => m.id);

  const attachmentsByMsg = new Map<string, ChatAttachment[]>();
  const reactionsByMsg = new Map<
    string,
    { emoji: string; user_id: string }[]
  >();

  const { data: atts, error: attErr } = await supabase
    .from("message_attachments")
    .select(
      "id, message_id, storage_path, mime_type, file_name, size_bytes, kind",
    )
    .in("message_id", ids);

  if (attErr) {
    console.error("loadConversationMessages attachments", attErr.message);
  } else {
    // Sign only media that must play/preview in-thread (images + audio).
    // Documents: no signed URL until user taps Descarregar (no auto-download).
    const mediaPaths = (atts ?? [])
      .filter((a) => a.kind === "image" || a.kind === "audio")
      .map((a) => a.storage_path as string);
    const urlMap = await signedChatUrls(supabase, mediaPaths);

    for (const a of atts ?? []) {
      const kind = a.kind as ChatAttachment["kind"];
      const item: ChatAttachment = {
        id: a.id,
        storage_path: a.storage_path,
        mime_type: a.mime_type,
        file_name: a.file_name,
        size_bytes: a.size_bytes,
        kind,
        url:
          kind === "document"
            ? null
            : (urlMap.get(a.storage_path) ?? null),
      };
      const arr = attachmentsByMsg.get(a.message_id) ?? [];
      arr.push(item);
      attachmentsByMsg.set(a.message_id, arr);
    }
  }

  const linkPreviewByMsg = new Map<
    string,
    { url: string; titulo: string | null; imagem_url: string | null; dominio: string | null }
  >();
  const { data: previews, error: previewErr } = await supabase
    .from("message_link_previews")
    .select("message_id, url, titulo, imagem_url, dominio")
    .in("message_id", ids);

  if (previewErr) {
    console.error("loadConversationMessages link previews", previewErr.message);
  } else {
    for (const p of previews ?? []) {
      linkPreviewByMsg.set(p.message_id, {
        url: p.url,
        titulo: p.titulo,
        imagem_url: p.imagem_url,
        dominio: p.dominio,
      });
    }
  }

  const { data: reacts, error: reactErr } = await supabase
    .from("message_reactions")
    .select("message_id, emoji, user_id")
    .in("message_id", ids);

  if (reactErr) {
    console.error("loadConversationMessages reactions", reactErr.message);
  } else {
    for (const r of reacts ?? []) {
      const arr = reactionsByMsg.get(r.message_id) ?? [];
      arr.push({ emoji: r.emoji, user_id: r.user_id });
      reactionsByMsg.set(r.message_id, arr);
    }
  }

  const byId = new Map(list.map((m) => [m.id, m]));
  const messages: ChatMessage[] = [];

  for (const m of list) {
    let reply_preview: ChatMessage["reply_preview"] = null;
    if (m.reply_to_id && byId.has(m.reply_to_id)) {
      const parent = byId.get(m.reply_to_id)!;
      reply_preview = {
        id: parent.id,
        body: parent.deleted_at ? null : parent.body,
        sender_id: parent.sender_id,
        message_type: (parent.message_type ?? "text") as MessageType,
        deleted: Boolean(parent.deleted_at),
      };
    }

    messages.push({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      body: m.body,
      message_type: (m.message_type ?? "text") as MessageType,
      reply_to_id: m.reply_to_id,
      deleted_at: m.deleted_at,
      created_at: m.created_at,
      attachments: attachmentsByMsg.get(m.id) ?? [],
      reactions: reactionsByMsg.get(m.id) ?? [],
      forwarded: Boolean(m.forwarded),
      link_preview: linkPreviewByMsg.get(m.id) ?? null,
      reply_preview,
    });
  }

  return messages;
}
