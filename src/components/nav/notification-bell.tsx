"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { unreadBadgeLabel } from "@/lib/notifications/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Header bell with realtime unread badge (cap 9+). */
export function NotificationBell({
  initialCount = 0,
  className,
}: {
  initialCount?: number;
  className?: string;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function setup() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      channel = supabase
        .channel(`notif-bell:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${user.id}`,
          },
          async () => {
            const { count: c } = await supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("recipient_id", user.id)
              .eq("is_read", false);
            if (!cancelled) setCount(c ?? 0);
          },
        )
        .subscribe();
    }

    void setup();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const badge = unreadBadgeLabel(count);

  return (
    <Link
      href="/notificacoes"
      aria-label={
        badge ? `Notificações, ${badge} não lidas` : "Notificações"
      }
      className={cn(
        "relative rounded-full p-2.5 text-foreground/80 transition-all duration-200 ease-out hover:bg-muted hover:text-foreground active:scale-95",
        className,
      )}
    >
      <Bell className="h-[22px] w-[22px]" strokeWidth={1.5} />
      {badge && (
        <span
          className="absolute right-1 top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-brand-foreground tabular-nums transition-opacity"
          aria-hidden
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
