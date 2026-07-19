import { notFound } from "next/navigation";

import { ChatView } from "@/components/messages/chat-view";
import { loadConversationMessages } from "@/lib/chat/load";
import { requireUser } from "@/lib/auth/session";
import { markConversationRead } from "@/lib/social/messages";
import type { Profile } from "@/types/database";

type Props = { params: Promise<{ id: string }> };

export default async function ConversaPage({ params }: Props) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: membership } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership) {
    // Fire-and-forget: don't block render on this.
    void markConversationRead(supabase, id);
  }

  if (!membership) notFound();

  const { data: peers } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", id)
    .neq("user_id", user.id);

  const peerId = peers?.[0]?.user_id;
  let peerName = "Conversa";
  let peerUsername: string | null = null;
  let peerAvatarUrl: string | null = null;

  if (peerId) {
    const { data: peer } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", peerId)
      .maybeSingle();
    if (peer) {
      const p = peer as Pick<
        Profile,
        "display_name" | "username" | "avatar_url"
      >;
      peerName = p.display_name || p.username;
      peerUsername = p.username;
      peerAvatarUrl = p.avatar_url;
    }
  }

  const messages = await loadConversationMessages(supabase, id);

  return (
    <ChatView
      conversationId={id}
      userId={user.id}
      peerId={peerId ?? null}
      peerName={peerName}
      peerUsername={peerUsername}
      peerAvatarUrl={peerAvatarUrl}
      initialMessages={messages}
    />
  );
}
