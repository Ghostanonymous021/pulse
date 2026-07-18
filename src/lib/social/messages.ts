import type { SupabaseClient } from "@supabase/supabase-js";

import type { MessageType } from "@/lib/chat/types";
import type { Profile } from "@/types/database";

export type ConversationListItem = {
  id: string;
  other: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
  lastMessage: {
    body: string | null;
    created_at: string;
    sender_id: string;
    message_type: MessageType;
    deleted_at: string | null;
  } | null;
};

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConversationListItem[]> {
  const { data: memberships, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  if (error) {
    console.error("listConversations memberships", error.message);
    return [];
  }
  if (!memberships?.length) return [];

  const convIds = memberships.map((m) => m.conversation_id);

  // Two-step: avoid fragile nested embeds across RLS
  const { data: participants, error: pErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", convIds);

  if (pErr) {
    console.error("listConversations participants", pErr.message);
    return [];
  }

  const otherIds = [
    ...new Set(
      (participants ?? [])
        .filter((p) => p.user_id !== userId)
        .map((p) => p.user_id),
    ),
  ];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p] as const),
  );

  const { data: messages } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, body, created_at, message_type, deleted_at",
    )
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });

  const lastByConv = new Map<
    string,
    {
      body: string | null;
      created_at: string;
      sender_id: string;
      message_type: MessageType;
      deleted_at: string | null;
    }
  >();
  for (const m of messages ?? []) {
    if (!lastByConv.has(m.conversation_id)) {
      lastByConv.set(m.conversation_id, {
        body: m.body,
        created_at: m.created_at,
        sender_id: m.sender_id,
        message_type: (m.message_type as MessageType) ?? "text",
        deleted_at: m.deleted_at ?? null,
      });
    }
  }

  const otherByConv = new Map<string, string>();
  for (const row of participants ?? []) {
    if (row.user_id === userId) continue;
    otherByConv.set(row.conversation_id, row.user_id);
  }

  // Only list threads that already have at least one message.
  // Opening "Mensagem" from a profile creates the conversation row early
  // (get_or_create_dm); empty shells must not pollute the inbox.
  const items: ConversationListItem[] = [];
  for (const id of convIds) {
    const last = lastByConv.get(id);
    if (!last) continue;
    const otherId = otherByConv.get(id);
    if (!otherId) continue;
    const other = profileById.get(otherId);
    if (!other) continue;
    items.push({
      id,
      other: {
        id: other.id,
        username: other.username,
        display_name: other.display_name,
        avatar_url: other.avatar_url,
      },
      lastMessage: last,
    });
  }

  items.sort((a, b) => {
    const ta = a.lastMessage?.created_at ?? "";
    const tb = b.lastMessage?.created_at ?? "";
    return tb.localeCompare(ta);
  });

  return items;
}

export async function openDmWithUsername(
  supabase: SupabaseClient,
  username: string,
): Promise<{ conversationId: string } | { error: string }> {
  const handle = username.trim().toLowerCase();
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", handle)
    .maybeSingle();

  if (pErr) {
    console.error("openDm profile", pErr.message);
    return { error: pErr.message };
  }
  if (!profile) return { error: "Utilizador não encontrado." };

  const { data, error } = await supabase.rpc("get_or_create_dm", {
    other_id: profile.id,
  });

  if (error) {
    console.error("openDm rpc", error.message, error.details, error.hint);
    return { error: error.message };
  }
  if (!data) return { error: "Não foi possível abrir a conversa." };

  return { conversationId: String(data) };
}
