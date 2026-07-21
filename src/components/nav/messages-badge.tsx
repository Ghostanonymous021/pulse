"use client";

import { useEffect, useState } from "react";

import { unreadBadgeLabel } from "@/lib/notifications/types";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 20_000;

/**
 * Small dot/count badge for the footer "Mensagens" tab icon.
 * Polls unread_conversations_count(); also refreshes on new
 * realtime message inserts for conversations the user belongs to.
 */
export function MessagesBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refresh() {
      const { data, error } = await supabase.rpc("unread_conversations_count");
      if (!cancelled && !error) setCount(Number(data ?? 0));
    }

    async function setup() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      await refresh();

      channel = supabase
        .channel(`messages-badge:${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          () => {
            void refresh();
          },
        )
        .subscribe();
    }

    void setup();
    const poll = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const badge = unreadBadgeLabel(count);
  if (!badge) return null;

  return (
    <span
      className="absolute -right-1.5 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-brand-foreground tabular-nums"
      aria-hidden
    >
      {badge}
    </span>
  );
}
