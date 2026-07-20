"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { UserAvatar } from "@/components/profile/user-avatar";
import { inboxTimeLabel, messagePreview } from "@/lib/chat/preview";
import type { ConversationListItem } from "@/lib/social/messages";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Inbox list — starts from the server-rendered snapshot, then stays
 * live: any new message in any of the user's conversations (sent or
 * received) re-fetches the list, so unread dots, bold names, preview
 * text and ordering update without a manual reload — whether the
 * user is sitting on this page or comes back to it from a chat.
 */
export function InboxList({
  initialConversations,
  userId,
}: {
  initialConversations: ConversationListItem[];
  userId: string;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const refreshingRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    async function refresh() {
      if (refreshingRef.current) {
        pendingRef.current = true;
        return;
      }
      refreshingRef.current = true;
      try {
        const res = await fetch("/api/conversations", { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as {
            conversations?: ConversationListItem[];
          };
          if (body.conversations) setConversations(body.conversations);
        }
      } catch {
        /* next event or manual reload will catch up */
      } finally {
        refreshingRef.current = false;
        if (pendingRef.current) {
          pendingRef.current = false;
          void refresh();
        }
      }
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  if (conversations.length === 0) return null;

  return (
    <ul>
      {conversations.map((c) => {
        const preview = c.lastMessage
          ? messagePreview(c.lastMessage)
          : "Inicia a conversa";
        const prefix =
          c.lastMessage && c.lastMessage.sender_id === userId ? "Tu: " : "";
        const time = c.lastMessage
          ? inboxTimeLabel(c.lastMessage.created_at)
          : null;

        return (
          <li key={c.id}>
            <Link
              href={`/mensagens/${c.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted/50 hover:bg-muted/35"
            >
              <UserAvatar
                userId={c.other.id}
                avatarUrl={c.other.avatar_url}
                name={c.other.display_name || c.other.username}
                size={52}
                className="ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
              />
              <div className="min-w-0 flex-1 border-b border-[var(--separator)] pb-3 pt-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cn(
                      "truncate text-[16px] tracking-[-0.02em]",
                      c.unread ? "font-bold" : "font-semibold",
                    )}
                  >
                    {c.other.display_name || c.other.username}
                  </p>
                  {time ? (
                    <span
                      className={cn(
                        "shrink-0 text-[12px] tabular-nums",
                        c.unread
                          ? "font-semibold text-[#FF9F0A]"
                          : "text-muted-foreground",
                      )}
                    >
                      {time}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-[14px]",
                      c.unread
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {prefix}
                    {preview}
                  </p>
                  {c.unread && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#FF9F0A]"
                      aria-label="Não lida"
                    />
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
