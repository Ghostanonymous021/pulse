"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/profile/user-avatar";
import {
  formatNotificationCopy,
  type NotificationView,
} from "@/lib/notifications/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function NotificationsList({
  initial,
}: {
  initial: NotificationView[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  function markOne(id: string) {
    startTransition(async () => {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.rpc("mark_all_notifications_read");
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      router.refresh();
    });
  }

  const unread = items.some((n) => !n.is_read);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Sem actividade"
        description="Curtidas, comentários e seguidores novos aparecem aqui."
      />
    );
  }

  return (
    <div>
      {unread && (
        <div className="flex justify-end px-4 py-2">
          <button
            type="button"
            disabled={pending}
            onClick={markAll}
            className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Marcar todas como lidas
          </button>
        </div>
      )}
      <ul className="divide-y divide-[var(--separator)] border-t border-[var(--separator)]">
        {items.map((n) => {
          const { title, href } = formatNotificationCopy(n);
          const when = relative(n.created_at);
          return (
            <li key={n.id}>
              <Link
                href={href}
                onClick={() => {
                  if (!n.is_read) markOne(n.id);
                }}
                className={cn(
                   "flex gap-3 px-4 py-3.5 transition-all duration-200 ease-out hover:bg-muted/40 active:scale-[0.98]",
                  !n.is_read && "bg-muted/25",
                )}
              >
                {n.actor ? (
                  <UserAvatar
                    userId={n.actor.id}
                    avatarUrl={n.actor.avatar_url}
                    name={
                      n.actor.display_name || n.actor.username || "?"
                    }
                    size={40}
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-muted-foreground">
                    ?
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-snug tracking-[-0.01em]">
                    {title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {when}
                  </p>
                </div>
                {!n.is_read && (
                  <span
                     className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand transition-opacity"
                    aria-label="Não lida"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function relative(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
