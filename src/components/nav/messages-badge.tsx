"use client";

import { useEffect, useState } from "react";

import { unreadBadgeLabel } from "@/lib/notifications/types";
import { createClient } from "@/lib/supabase/client";

/** Fallback only — realtime is the primary path. */
const POLL_MS = 90_000;

/**
 * Footer "Mensagens" badge.
 *
 * Strategy (WhatsApp / Instagram):
 * - Realtime INSERT on messages → refresh count immediately
 * - Long poll only as safety net when tab is visible
 * - Pause when document.hidden (no battery / radio waste in background)
 */
export function MessagesBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    async function refresh() {
      if (document.hidden) return;
      const { data, error } = await supabase.rpc("unread_conversations_count");
      if (!cancelled && !error) setCount(Number(data ?? 0));
    }

    function startPoll() {
      if (poll) clearInterval(poll);
      poll = setInterval(refresh, POLL_MS);
    }

    async function setup() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
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

      startPoll();
    }

    function onVis() {
      if (!document.hidden) void refresh();
    }

    void setup();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const badge = unreadBadgeLabel(count);
  if (!badge) return null;

  return (
    <span
      className="absolute -right-1.5 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-brand-foreground tabular-nums transition-all duration-200 ease-out active:scale-95"
      aria-hidden
    >
      {badge}
    </span>
  );
}
