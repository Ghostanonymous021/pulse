"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { ChatBubble } from "@/components/messages/chat-bubble";
import {
  ChatComposer,
  type ChatSendPayload,
} from "@/components/messages/chat-composer";
import { UserAvatar } from "@/components/profile/user-avatar";
import { buildChatRows, sameDay } from "@/lib/chat/dates";
import type { ChatAttachment, ChatMessage } from "@/lib/chat/types";
import { uploadChatFile } from "@/lib/chat/upload";
import { createClient } from "@/lib/supabase/client";

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
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
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

    return () => {
      void supabase.removeChannel(channel);
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
      </header>

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
          return (
            <ChatBubble
              key={m.id}
              message={m}
              mine={m.sender_id === userId}
              peerName={peerName}
              cluster={clusterOf.get(m.id) ?? "single"}
              onReply={setReplyTo}
              onReact={handleReact}
              onDelete={handleDelete}
              onCopy={handleCopy}
              onCancelSend={handleCancelSend}
            />
          );
        })}
        <div ref={bottomRef} className="h-1" />
      </div>

      <ChatComposer
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={handleSend}
      />
    </div>
  );
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
