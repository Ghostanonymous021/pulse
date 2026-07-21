"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import Image from "next/image";

import { UserAvatar } from "@/components/profile/user-avatar";
import type { ChatMessage, ChatReaction } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatBubbleStyles = {
  bubble: string;
  meta: string;
  replyBorder: string;
  replyText: string;
};

const EMOJI_QUICK = ["👍", "❤️", "😂", "😢", "🔥", "🙏"];
const STICKER_PACK = ["😎", "🤓", "😅", "😉", "😋", "😴"];

export function ChatBubble({
  message,
  mine,
  showAvatar,
  reactions,
  onToggleReaction,
  peerName,
  cluster,
  pinned,
  onReply,
  onReact,
  onDelete,
  onDeleteForMe,
  onCopy,
  onCancelSend,
  onPin,
  onForward,
}: {
  message: ChatMessage;
  mine: boolean;
  showAvatar?: boolean;
  reactions?: ChatReaction[];
  onToggleReaction?: (emoji: string) => void;
  peerName?: string;
  cluster?: "last" | "single" | "first" | "middle";
  pinned?: boolean;
  onReply?: (message: ChatMessage) => void;
  onReact?: (messageId: string, emoji: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
  onDeleteForMe?: (messageId: string) => Promise<void>;
  onCopy?: (text: string) => void;
  onCancelSend?: (id: string) => void;
  onPin?: (message: ChatMessage) => Promise<void>;
  onForward?: (message: ChatMessage) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    const handle = (e: Event) => {
      const el = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(el) &&
        (!sheetRef.current || !sheetRef.current.contains(el))
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, []);

  const isSticker = message.message_type === "sticker";
  const imageOnly =
    message.body == null &&
    message.attachments.some((m) => m.mime_type?.startsWith("image/"));

  const senderLabel = peerName || message.sender_id.slice(0, 8);

  const styles: ChatBubbleStyles = useMemo(
    () => ({
      bubble: mine
        ? "bg-brand text-brand-foreground"
        : "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
      meta: mine ? "text-brand-foreground/85" : "text-muted-foreground",
      replyBorder: mine ? "border-l-white/80 bg-black/10" : "border-l-brand bg-black/[0.04] dark:bg-white/[0.06]",
      replyText: mine ? "text-brand-foreground" : "text-brand",
    }),
    [mine],
  );

  async function copyText() {
    if (message.body) {
      await navigator.clipboard.writeText(message.body);
    }
    setMenuOpen(false);
  }

  function openForward() {
    setMenuOpen(false);
  }

  function forwardTo(conversationId: string) {
    setMenuOpen(false);
  }

  async function removeDoc() {
    setMenuOpen(false);
  }

  async function deleteJustForMe() {
    setMenuOpen(false);
  }

  async function deleteForEveryone() {
    setMenuOpen(false);
  }

  async function replySubmit() {
    const text = replyText.trim();
    if (!text) return;
    setReplyText("");
    setReplyOpen(false);
  }

  if (!mounted) return null;

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className="flex max-w-[85%] gap-2">
        {!mine && showAvatar && (
          <UserAvatar
            userId={message.sender_id}
            avatarUrl={undefined}
            name={senderLabel}
            size={28}
          />
        )}

        <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
          <div
            className={cn(
              "rounded-2xl",
              isSticker ? "bg-transparent p-0" : "px-3.5 py-2.5",
              styles.bubble,
              !isSticker && "shadow-sm",
            )}
          >
            {message.body && !isSticker && (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                {message.body}
              </p>
            )}

            {message.attachments.map((m, idx) => (
              <div
                key={m.id}
                className={cn(
                  "mt-2 overflow-hidden rounded-xl",
                  message.attachments.length > 1 ? "h-48 w-48" : "max-h-[50vh] w-full",
                )}
              >
                {m.mime_type?.startsWith("image/") ? (
                  <Image
                    src={m.url!}
                    alt="Anexo"
                    className="h-full w-full object-cover"
                    draggable={false}
                    width={512}
                    height={512}
                    onClick={() => {
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                  />
                ) : m.mime_type?.startsWith("audio/") ? (
                  <audio controls className="w-full" />
                ) : (
                  <a
                    href={m.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm underline"
                  >
                    Documento
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <time className="text-[11px] opacity-75">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
            {reactions?.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onToggleReaction?.(r.emoji)}
                className="text-xs opacity-85 transition-opacity hover:opacity-100"
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
