"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Check,
  CheckCheck,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Mic,
  Pin,
  PinOff,
  Search,
  Sticker,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { UserAvatar } from "@/components/profile/user-avatar";
import { inboxTimeLabel, messagePreview } from "@/lib/chat/preview";
import {
  setConversationArchived,
  setConversationMuted,
  setConversationPinned,
  type ConversationListItem,
} from "@/lib/social/messages";
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
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
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
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Wait for the auth session to resolve before subscribing. If the
    // channel joins before the Realtime socket has the user's JWT, its
    // postgres_changes RLS check gets locked in as `anon` — any later
    // access_token update no longer re-authorizes an already-joined
    // channel — so this refresh would silently stop firing on new
    // messages until the next remount. See chat-view.tsx for the same
    // fix and a fuller explanation.
    async function setup() {
      await supabase.auth.getSession();
      if (cancelled) return;

      channel = supabase
        .channel(`inbox:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          () => void refresh(),
        )
        .subscribe();
    }

    void setup();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function toggleMute(c: ConversationListItem) {
    setConversations((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, muted: !x.muted } : x)),
    );
    await setConversationMuted(createClient(), c.id, !c.muted);
  }

  async function togglePin(c: ConversationListItem) {
    setConversations((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, pinned: !x.pinned } : x)),
    );
    await setConversationPinned(createClient(), c.id, !c.pinned);
  }

  async function toggleArchive(c: ConversationListItem) {
    setConversations((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, archived: !x.archived } : x)),
    );
    await setConversationArchived(createClient(), c.id, !c.archived);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = (c.other.display_name || c.other.username).toLowerCase();
      const handle = c.other.username.toLowerCase();
      const body = (c.lastMessage?.body ?? "").toLowerCase();
      return name.includes(q) || handle.includes(q) || body.includes(q);
    });
  }, [conversations, query]);

  const active = filtered.filter((c) => !c.archived);
  const archived = filtered.filter((c) => c.archived);

  if (conversations.length === 0) return null;

  return (
    <div>
      <div className="border-b border-[var(--separator)] px-4 py-2.5">
        <div className="flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar conversas"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              aria-label="Limpar pesquisa"
              onClick={() => setQuery("")}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      <ul>
        {active.map((c) => (
          <InboxRow
            key={c.id}
            c={c}
            userId={userId}
            menuOpen={menuFor === c.id}
            onOpenMenu={() => setMenuFor(c.id)}
            onCloseMenu={() => setMenuFor(null)}
            onToggleMute={() => void toggleMute(c)}
            onTogglePin={() => void togglePin(c)}
            onToggleArchive={() => void toggleArchive(c)}
          />
        ))}
      </ul>

      {archived.length > 0 && (
        <div className="border-t border-[var(--separator)]">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-[14px] font-medium text-muted-foreground hover:bg-muted/30"
          >
            <Archive className="h-4 w-4" strokeWidth={1.5} />
            <span className="flex-1">Arquivadas ({archived.length})</span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", showArchived && "rotate-180")}
              strokeWidth={1.5}
            />
          </button>
          {showArchived && (
            <ul>
              {archived.map((c) => (
                <InboxRow
                  key={c.id}
                  c={c}
                  userId={userId}
                  menuOpen={menuFor === c.id}
                  onOpenMenu={() => setMenuFor(c.id)}
                  onCloseMenu={() => setMenuFor(null)}
                  onToggleMute={() => void toggleMute(c)}
                  onTogglePin={() => void togglePin(c)}
                  onToggleArchive={() => void toggleArchive(c)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function InboxRow({
  c,
  userId,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onToggleMute,
  onTogglePin,
  onToggleArchive,
}: {
  c: ConversationListItem;
  userId: string;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onToggleMute: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
}) {
  const preview = c.lastMessage
    ? messagePreview(c.lastMessage)
    : "Inicia a conversa";
  const prefix =
    c.lastMessage && c.lastMessage.sender_id === userId ? "Tu: " : "";
  const time = c.lastMessage ? inboxTimeLabel(c.lastMessage.created_at) : null;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <li className="relative">
      <Link
        href={`/mensagens/${c.id}`}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenMenu();
        }}
        onTouchStart={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          longPressTimer.current = setTimeout(onOpenMenu, 420);
        }}
        onTouchEnd={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }}
        onTouchMove={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }}
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
                "flex min-w-0 items-center gap-1 truncate text-[16px] tracking-[-0.02em]",
                c.unread ? "font-bold" : "font-semibold",
              )}
            >
              {c.pinned && (
                <Pin
                  className="h-3 w-3 shrink-0 text-muted-foreground"
                  strokeWidth={2}
                  aria-label="Fixada"
                />
              )}
              <span className="truncate">
                {c.other.display_name || c.other.username}
              </span>
              {c.muted && (
                <VolumeX
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                  aria-label="Silenciada"
                />
              )}
            </p>
            {time ? (
              <span
                className={cn(
                  "shrink-0 text-[12px] tabular-nums",
                  c.unread && !c.muted
                    ? "font-semibold text-[#FF9F0A]"
                    : "text-muted-foreground",
                )}
              >
                {time}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {prefix && (
              <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
            )}
            <MediaTypeIcon type={c.lastMessage?.message_type} />
            <p
              className={cn(
                "min-w-0 flex-1 truncate text-[14px]",
                c.unread
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {preview}
            </p>
            {c.unread && !c.muted && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#FF9F0A]"
                aria-label="Não lida"
              />
            )}
          </div>
        </div>
      </Link>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={onCloseMenu}
            aria-hidden="true"
          />
          <div className="absolute right-4 top-2 z-50 min-w-[11rem] overflow-hidden rounded-2xl border border-[var(--separator)] bg-[var(--elevated)] py-1 shadow-xl backdrop-blur-xl">
            <RowMenuItem
              icon={
                c.pinned ? (
                  <PinOff className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Pin className="h-4 w-4" strokeWidth={1.5} />
                )
              }
              label={c.pinned ? "Desafixar" : "Fixar"}
              onClick={() => {
                onTogglePin();
                onCloseMenu();
              }}
            />
            <RowMenuItem
              icon={
                c.muted ? (
                  <Volume2 className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <VolumeX className="h-4 w-4" strokeWidth={1.5} />
                )
              }
              label={c.muted ? "Reativar notificações" : "Silenciar"}
              onClick={() => {
                onToggleMute();
                onCloseMenu();
              }}
            />
            <RowMenuItem
              icon={
                c.archived ? (
                  <ArchiveRestore className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Archive className="h-4 w-4" strokeWidth={1.5} />
                )
              }
              label={c.archived ? "Desarquivar" : "Arquivar"}
              onClick={() => {
                onToggleArchive();
                onCloseMenu();
              }}
            />
          </div>
        </>
      )}
    </li>
  );
}

function RowMenuItem({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] font-medium hover:bg-muted/60"
    >
      {icon}
      {label}
    </button>
  );
}

/** Small media-type glyph before the preview text (photo/doc/sticker/audio). */
function MediaTypeIcon({ type }: { type?: string | null }) {
  const cls = "h-3.5 w-3.5 shrink-0 text-muted-foreground";
  if (type === "image") return <ImageIcon className={cls} strokeWidth={1.75} />;
  if (type === "document") return <FileText className={cls} strokeWidth={1.75} />;
  if (type === "sticker") return <Sticker className={cls} strokeWidth={1.75} />;
  if (type === "audio") return <Mic className={cls} strokeWidth={1.75} />;
  return null;
}
