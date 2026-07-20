"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, ChevronLeft, Pin, Search, X } from "lucide-react";

import { ChatBubble } from "@/components/messages/chat-bubble";
import {
  ChatComposer,
  type ChatSendPayload,
} from "@/components/messages/chat-composer";
import { ForwardSheet } from "@/components/messages/forward-sheet";
import { UserAvatar } from "@/components/profile/user-avatar";
import {
  hideMessageForMe,
  loadPinnedMessage,
  pinMessage,
  searchMessagesInConversation,
  unpinMessage,
} from "@/lib/chat/actions";
import { buildChatRows, sameDay } from "@/lib/chat/dates";
import type { ChatAttachment, ChatMessage } from "@/lib/chat/types";
import { uploadChatFile } from "@/lib/chat/upload";
import { extractUrls } from "@/lib/links/urls";
import { markConversationDelivered } from "@/lib/social/messages";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Immersive 1:1 thread — WA interaction patterns, Apple surface language.
 */
export function ChatView({
  conversationId,
  userId,
  peerId,
  peerName,
  peerUsername,
  peerAvatarUrl,
  initialMessages,
}: {
  conversationId: string;
  userId: string;
  peerId?: string | null;
  peerName: string;
  peerUsername?: string | null;
  peerAvatarUrl?: string | null;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; body: string | null; created_at: string; sender_id: string }[]
  >([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  /** Abort controllers for in-flight uploads (cancel send) */
  const uploadsRef = useRef(new Map<string, AbortController>());

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "end",
    });
  }, []);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    void loadPinnedMessage(createClient(), conversationId).then((pinned) =>
      setPinnedId(pinned?.messageId ?? null),
    );
  }, [conversationId]);

  // Delivery tick: my messages reached the peer's client. Marked once
  // when they open the thread (not "seen" — no timing/scroll signal).
  useEffect(() => {
    void markConversationDelivered(createClient(), conversationId);
  }, [conversationId]);

  // Track the peer's last_delivered_at so I can show a delivery tick
  // on my own sent messages (never a read/"seen" signal — out of v1).
  const [peerDeliveredAt, setPeerDeliveredAt] = useState<string | null>(null);

  useEffect(() => {
    if (!peerId) return;
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void supabase
      .from("conversation_participants")
      .select("last_delivered_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", peerId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setPeerDeliveredAt(data?.last_delivered_at ?? null);
      });

    // Wait for the auth session before subscribing — see the `chat:`
    // channel effect below for why this matters (RLS locks the
    // channel to `anon` if we join before the JWT is set).
    void supabase.auth.getSession().then(() => {
      if (!active) return;
      channel = supabase
        .channel(`chat-delivery:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversation_participants",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as {
              user_id: string;
              last_delivered_at: string;
            };
            if (row.user_id === peerId) setPeerDeliveredAt(row.last_delivered_at);
          },
        )
        .subscribe();
    });

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversationId, peerId]);

  useEffect(() => {
    stickToBottom.current = true;
    // Double rAF: the first frame lets the DOM commit (messages just
    // mounted), the second lets layout/paint settle before measuring
    // scrollHeight -- a single rAF sometimes fires before images in
    // the last messages have taken their final layout size.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToBottom(false));
    });
    // Catch-up pass: media (images, link previews) in the last
    // messages can still be loading asynchronously after the frame
    // above, shifting the true bottom further down with nothing to
    // re-trigger the scroll. Re-snap once more shortly after.
    const catchUp = setTimeout(() => {
      if (stickToBottom.current) scrollToBottom(false);
    }, 350);
    return () => clearTimeout(catchUp);
  }, [conversationId, scrollToBottom]);

  useEffect(() => {
    if (stickToBottom.current) scrollToBottom(true);
  }, [messages.length, scrollToBottom]);

  // Realtime: peer messages + remote soft-deletes/reactions refresh lightly
  //
  // IMPORTANT: we must wait for the Supabase auth session to be resolved
  // before subscribing. On a fresh page load, createClient() returns a
  // client whose Realtime socket has no access_token yet (session recovery
  // from cookies is async). If we call .subscribe() immediately, the
  // channel's phx_join goes out authenticated as `anon`, and Realtime's
  // RLS check on `messages`/`conversation_participants` silently denies
  // every event for this channel — but the join itself still reports
  // "ok" and "Subscribed to PostgreSQL", making it look connected while
  // no INSERT events ever arrive. Awaiting getSession() first (like
  // MessagesBadge / notif-bell already do) ensures the realtime client's
  // accessTokenValue is set before the channel joins, so RLS sees the
  // authenticated user.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setup() {
      await supabase.auth.getSession();
      if (cancelled) return;

      channel = supabase
        .channel(`chat:${conversationId}`)
        .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            body: string | null;
            message_type: ChatMessage["message_type"];
            reply_to_id: string | null;
            deleted_at: string | null;
            created_at: string;
          };
          if (row.sender_id === userId) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const reply_preview = buildReplyPreview(prev, row.reply_to_id);
            return [
              ...prev,
              {
                id: row.id,
                conversation_id: row.conversation_id,
                sender_id: row.sender_id,
                body: row.body,
                message_type: row.message_type ?? "text",
                reply_to_id: row.reply_to_id,
                deleted_at: row.deleted_at,
                created_at: row.created_at,
                attachments: [],
                reactions: [],
                reply_preview,
              },
            ];
          });
          stickToBottom.current = true;

          // Media attachments land after the message row — hydrate shortly after
          if (
            row.message_type === "image" ||
            row.message_type === "document" ||
            row.message_type === "audio"
          ) {
            void hydrateAttachments(row.id).then((atts) => {
              if (!atts.length) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === row.id ? { ...m, attachments: atts } : m,
                ),
              );
            });
          }

          // Peer's link preview is fetched server-side on their send;
          // it can land slightly after this INSERT event.
          if (row.message_type === "text" && extractUrls(row.body, 1).length) {
            setTimeout(() => {
              void hydrateLinkPreview(row.id).then((preview) => {
                if (!preview) return;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === row.id ? { ...m, link_preview: preview } : m,
                  ),
                );
              });
            }, 1200);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            body: string | null;
            deleted_at: string | null;
          };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? { ...m, body: row.body, deleted_at: row.deleted_at }
                : m,
            ),
          );
        },
      )
        .subscribe();
    }

    void setup();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  async function handleSend(payload: ChatSendPayload) {
    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const reply_preview = buildReplyPreview(messages, payload.replyToId);
    const files = payload.attachments ?? [];
    const abort = new AbortController();
    uploadsRef.current.set(tempId, abort);

    const optimisticAttachments: ChatAttachment[] = files.map((att, i) => ({
      id: `${tempId}-att-${i}`,
      storage_path: "",
      mime_type: att.file.type,
      file_name: att.file.name,
      size_bytes: att.file.size,
      kind: att.kind,
      // Local preview only for images/audio — never force download of docs
      url:
        att.kind === "image" || att.kind === "audio"
          ? (att.previewUrl ?? null)
          : null,
      duration_sec: att.durationSec ?? null,
    }));

    const optimistic: ChatMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: userId,
      body: payload.body,
      message_type: payload.type,
      reply_to_id: payload.replyToId,
      deleted_at: null,
      created_at: now,
      attachments: optimisticAttachments,
      reactions: [],
      reply_preview,
      pending: true,
      upload_progress: files.length ? 0 : undefined,
    };

    stickToBottom.current = true;
    setMessages((prev) => [...prev, optimistic]);
    setReplyTo(null);

    const supabase = createClient();
    let realMsgId: string | null = null;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!accessToken || !supabaseUrl || !anonKey) {
        throw new Error("Sessao invalida.");
      }

      if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");

      const { data: msg, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          body: payload.body,
          message_type: payload.type,
          reply_to_id: payload.replyToId,
        })
        .select("id, created_at")
        .single();

      if (error || !msg) throw error ?? new Error("Falha ao enviar");
      realMsgId = msg.id as string;

      // Re-key abort map to real id for cancel after insert
      uploadsRef.current.delete(tempId);
      uploadsRef.current.set(realMsgId, abort);

      const attachments: ChatAttachment[] = [];
      const n = Math.max(1, files.length);

      for (let i = 0; i < files.length; i++) {
        if (abort.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        const item = files[i];
        const file = item.file;
        const ext = file.name.split(".").pop() || "bin";
        const path = `${userId}/${conversationId}/${msg.id}/${i}.${ext}`;

        await uploadChatFile({
          supabaseUrl,
          anonKey,
          accessToken,
          bucket: "chat-media",
          path,
          file,
          contentType: file.type || "application/octet-stream",
          signal: abort.signal,
          onProgress: (pct) => {
            const overall = Math.round(((i + pct / 100) / n) * 100);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId || m.id === realMsgId
                  ? { ...m, upload_progress: overall, pending: true }
                  : m,
              ),
            );
          },
        });

        const { data: att } = await supabase
          .from("message_attachments")
          .insert({
            message_id: msg.id,
            storage_path: path,
            mime_type: file.type || "application/octet-stream",
            file_name: file.name,
            size_bytes: file.size,
            kind: item.kind,
          })
          .select("id, storage_path, mime_type, file_name, size_bytes, kind")
          .single();

        if (!att) continue;

        // Sign for local preview (image/audio). Documents: signed on demand only.
        let url: string | null = null;
        if (item.kind === "image" || item.kind === "audio") {
          const { data: signed } = await supabase.storage
            .from("chat-media")
            .createSignedUrl(path, 3600);
          url = signed?.signedUrl ?? item.previewUrl ?? null;
        }
        attachments.push({
          id: att.id,
          storage_path: att.storage_path,
          mime_type: att.mime_type,
          file_name: att.file_name,
          size_bytes: att.size_bytes,
          kind: att.kind,
          url,
          duration_sec: item.durationSec ?? null,
        });
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId || m.id === realMsgId
            ? {
                ...m,
                id: msg.id,
                created_at: msg.created_at,
                pending: false,
                upload_progress: undefined,
                attachments: attachments.length
                  ? attachments
                  : optimisticAttachments,
              }
            : m,
        ),
      );

      // Unfurl once after send (cached). Never blocks the bubble; a
      // failed fetch just leaves the URL as a plain clickable link.
      if (payload.type === "text" && extractUrls(payload.body, 1).length) {
        void fetch("/api/messages/link-previews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: msg.id }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            const ok = data?.previews?.[0]?.ok;
            if (!ok) return;
            void hydrateLinkPreview(msg.id).then((preview) => {
              if (!preview) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msg.id ? { ...m, link_preview: preview } : m,
                ),
              );
            });
          })
          .catch(() => {});
      }
    } catch (err) {
      const aborted =
        err instanceof DOMException && err.name === "AbortError";
      if (aborted) {
        // Remove bubble; clean DB if message was already created
        setMessages((prev) =>
          prev.filter((m) => m.id !== tempId && m.id !== realMsgId),
        );
        if (realMsgId) {
          void supabase.from("messages").delete().eq("id", realMsgId);
        }
      } else {
        console.error("send message", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId || m.id === realMsgId
              ? {
                  ...m,
                  pending: false,
                  failed: true,
                  upload_progress: undefined,
                }
              : m,
          ),
        );
      }
    } finally {
      uploadsRef.current.delete(tempId);
      if (realMsgId) uploadsRef.current.delete(realMsgId);
    }
  }

  function handleCancelSend(messageId: string) {
    const ctrl = uploadsRef.current.get(messageId);
    if (ctrl) {
      ctrl.abort();
      return;
    }
    // Pending bubble without active controller (edge)
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  async function handleReact(messageId: string, emoji: string) {
    if (messageId.startsWith("temp-")) return;
    const supabase = createClient();
    const existing = messages
      .find((m) => m.id === messageId)
      ?.reactions.find((r) => r.user_id === userId);

    // Optimistic reaction
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        let reactions = m.reactions.filter((r) => r.user_id !== userId);
        if (existing?.emoji !== emoji) {
          reactions = [...reactions, { emoji, user_id: userId }];
        }
        return { ...m, reactions };
      }),
    );

    if (existing?.emoji === emoji) {
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId);
    } else if (existing) {
      await supabase
        .from("message_reactions")
        .update({ emoji })
        .eq("message_id", messageId)
        .eq("user_id", userId);
    } else {
      await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: userId,
        emoji,
      });
    }
  }

  async function handleDelete(messageId: string) {
    if (messageId.startsWith("temp-")) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, deleted_at: new Date().toISOString(), body: null }
          : m,
      ),
    );
    const supabase = createClient();
    await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), body: null })
      .eq("id", messageId)
      .eq("sender_id", userId);
  }

  function handleCopy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  async function handleDeleteForMe(messageId: string) {
    if (messageId.startsWith("temp-")) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    await hideMessageForMe(createClient(), messageId, userId);
  }

  async function handlePin(message: ChatMessage) {
    const supabase = createClient();
    if (pinnedId === message.id) {
      setPinnedId(null);
      await unpinMessage(supabase, conversationId);
    } else {
      setPinnedId(message.id);
      await pinMessage(supabase, conversationId, message.id, userId);
    }
  }

  function handleForward(message: ChatMessage) {
    setForwardMsg(message);
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const results = await searchMessagesInConversation(
      createClient(),
      conversationId,
      query,
    );
    setSearchResults(results);
  }

  function jumpToMessage(messageId: string) {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("chat-highlight");
      setTimeout(() => el.classList.remove("chat-highlight"), 1500);
    }
  }

  const pinnedMessage = pinnedId ? messages.find((m) => m.id === pinnedId) : null;

  const rows = useMemo(() => buildChatRows(messages), [messages]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const clusterOf = useMemo(() => computeClusters(messages), [messages]);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-1 border-b border-[var(--separator)] bg-[var(--elevated)] px-2 backdrop-blur-xl backdrop-saturate-150">
        <Link
          href="/mensagens"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground/90 transition-opacity hover:opacity-70"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
        </Link>

        <Link
          href={peerUsername ? `/u/${peerUsername}` : "/mensagens"}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1 pr-2 transition-opacity hover:opacity-80"
        >
          {peerId ? (
            <UserAvatar
              userId={peerId}
              avatarUrl={peerAvatarUrl}
              name={peerName}
              size={36}
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[13px] font-semibold text-muted-foreground">
              {peerName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold tracking-[-0.02em]">
              {peerName}
            </p>
            {peerUsername ? (
              <p className="truncate text-[12px] text-muted-foreground">
                @{peerUsername}
              </p>
            ) : null}
          </div>
        </Link>

        <button
          type="button"
          aria-label="Pesquisar na conversa"
          onClick={() => setSearchOpen((v) => !v)}
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70",
            searchOpen ? "text-[#007AFF] dark:text-[#0A84FF]" : "text-foreground/90",
          )}
        >
          <Search className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </header>

      {searchOpen && (
        <div className="sticky top-14 z-10 border-b border-[var(--separator)] bg-[var(--elevated)] px-3 py-2 backdrop-blur-xl">
          <div className="flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => void handleSearch(e.target.value)}
              placeholder="Pesquisar mensagens"
              className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Limpar pesquisa"
                onClick={() => void handleSearch("")}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[var(--separator)] bg-card">
              {searchResults.length === 0 ? (
                <p className="px-3 py-3 text-[13px] text-muted-foreground">
                  Sem resultados.
                </p>
              ) : (
                searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => jumpToMessage(r.id)}
                    className="block w-full border-b border-[var(--separator)] px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
                  >
                    <p className="truncate text-[13px]">{r.body}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.sender_id === userId ? "Tu" : peerName}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {pinnedMessage && !searchOpen && (
        <button
          type="button"
          onClick={() => jumpToMessage(pinnedMessage.id)}
          className="sticky top-14 z-10 flex w-full items-center gap-2 border-b border-[var(--separator)] bg-[var(--elevated)] px-3.5 py-2 text-left backdrop-blur-xl"
        >
          <Pin className="h-3.5 w-3.5 shrink-0 text-[#007AFF] dark:text-[#0A84FF]" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#007AFF] dark:text-[#0A84FF]">
              Mensagem fixada
            </p>
            <p className="truncate text-[13px] text-foreground/80">
              {pinnedMessage.deleted_at
                ? "Mensagem apagada"
                : pinnedMessage.body || typeLabelForPin(pinnedMessage.message_type)}
            </p>
          </div>
        </button>
      )}

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 pb-[calc(7.5rem+env(safe-area-inset-bottom))]"
        onScroll={(e) => {
          const el = e.currentTarget;
          const dist =
            el.scrollHeight - el.scrollTop - el.clientHeight;
          stickToBottom.current = dist < 80;
        }}
      >
        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-[17rem] text-center">
            <div className="mx-auto mb-4 flex justify-center">
              {peerId ? (
                <UserAvatar
                  userId={peerId}
                  avatarUrl={peerAvatarUrl}
                  name={peerName}
                  size={64}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted text-xl font-semibold text-muted-foreground">
                  {peerName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">
              {peerName}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Envia a primeira mensagem.
            </p>
          </div>
        )}

        {rows.map((row) => {
          if (row.kind === "day") {
            return (
              <div key={row.id} className="flex justify-center py-3">
                <span className="rounded-full bg-muted/90 px-3 py-1 text-[11px] font-medium capitalize tracking-[-0.01em] text-muted-foreground">
                  {row.label}
                </span>
              </div>
            );
          }
          const m = byId.get(row.messageId);
          if (!m) return null;
          const mine = m.sender_id === userId;
          const isLastMine =
            mine && messages[messages.length - 1]?.id === m.id && !m.pending;
          return (
            <div key={m.id} id={`msg-${m.id}`} className="scroll-mt-24">
              <ChatBubble
                message={m}
                mine={mine}
                peerName={peerName}
                cluster={clusterOf.get(m.id) ?? "single"}
                pinned={pinnedId === m.id}
                onReply={setReplyTo}
                onReact={handleReact}
                onDelete={handleDelete}
                onDeleteForMe={handleDeleteForMe}
                onCopy={handleCopy}
                onCancelSend={handleCancelSend}
                onPin={handlePin}
                onForward={handleForward}
              />
              {isLastMine && (
                <div className="mt-0.5 flex items-center justify-end gap-1 pr-1 text-muted-foreground">
                  <span className="text-[10px]">
                    {peerDeliveredAt && peerDeliveredAt >= m.created_at
                      ? "Entregue"
                      : "Enviado"}
                  </span>
                  {peerDeliveredAt && peerDeliveredAt >= m.created_at ? (
                    <CheckCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} className="h-1" />
      </div>

      <ChatComposer
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={handleSend}
      />

      {forwardMsg && (
        <ForwardSheet
          message={forwardMsg}
          userId={userId}
          onClose={() => setForwardMsg(null)}
        />
      )}
    </div>
  );
}

function typeLabelForPin(type: ChatMessage["message_type"]) {
  if (type === "image") return "Foto";
  if (type === "document") return "Documento";
  if (type === "sticker") return "Sticker";
  if (type === "audio") return "Audio";
  return "Mensagem";
}

async function hydrateLinkPreview(messageId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("message_link_previews")
    .select("url, titulo, imagem_url, dominio")
    .eq("message_id", messageId)
    .maybeSingle();
  if (!data) return null;
  return {
    url: data.url as string,
    titulo: data.titulo as string | null,
    imagem_url: data.imagem_url as string | null,
    dominio: data.dominio as string | null,
  };
}

async function hydrateAttachments(messageId: string) {
  const supabase = createClient();
  // brief delay so attachment insert can commit
  await new Promise((r) => setTimeout(r, 400));
  const { data } = await supabase
    .from("message_attachments")
    .select("id, storage_path, mime_type, file_name, size_bytes, kind")
    .eq("message_id", messageId);

  const attachments: ChatAttachment[] = [];
  for (const a of data ?? []) {
    const { data: signed } = await supabase.storage
      .from("chat-media")
      .createSignedUrl(a.storage_path, 3600);
    attachments.push({
      id: a.id,
      storage_path: a.storage_path,
      mime_type: a.mime_type,
      file_name: a.file_name,
      size_bytes: a.size_bytes,
      kind: a.kind as ChatAttachment["kind"],
      url: signed?.signedUrl ?? null,
    });
  }
  return attachments;
}

function buildReplyPreview(
  messages: ChatMessage[],
  replyToId: string | null,
): ChatMessage["reply_preview"] {
  if (!replyToId) return null;
  const parent = messages.find((m) => m.id === replyToId);
  if (!parent) return null;
  return {
    id: parent.id,
    body: parent.deleted_at ? null : parent.body,
    sender_id: parent.sender_id,
    message_type: parent.message_type,
    deleted: Boolean(parent.deleted_at),
  };
}

function computeClusters(messages: ChatMessage[]) {
  const map = new Map<string, "single" | "first" | "middle" | "last">();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const samePrev =
      prev &&
      prev.sender_id === m.sender_id &&
      sameDay(prev.created_at, m.created_at) &&
      !prev.deleted_at &&
      !m.deleted_at;
    const sameNext =
      next &&
      next.sender_id === m.sender_id &&
      sameDay(next.created_at, m.created_at) &&
      !next.deleted_at &&
      !m.deleted_at;

    if (!samePrev && !sameNext) map.set(m.id, "single");
    else if (!samePrev && sameNext) map.set(m.id, "first");
    else if (samePrev && sameNext) map.set(m.id, "middle");
    else map.set(m.id, "last");
  }
  return map;
}
