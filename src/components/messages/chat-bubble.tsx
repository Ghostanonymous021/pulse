"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  ExternalLink,
  FileText,
  Forward,
  Copy,
  Loader2,
  Pause,
  Pin,
  Play,
  Reply,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";

import { MediaLightbox } from "@/components/feed/media-lightbox";
import { formatDuration } from "@/lib/chat/audio";
import { downloadFromUrl, formatBytes } from "@/lib/chat/download";
import { timeLabel } from "@/lib/chat/dates";
import type { ChatAttachment, ChatMessage } from "@/lib/chat/types";
import { REACTION_EMOJIS } from "@/lib/chat/types";
import { domainFromUrl } from "@/lib/links/urls";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Fixed popover geometry so menus are not clipped by the scroll area / composer. */
type PopoverPos = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

export function ChatBubble({
  message,
  mine,
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
  peerName: string;
  /** Position in consecutive same-sender cluster */
  cluster: "single" | "first" | "middle" | "last";
  /** This message is the conversation's pinned message */
  pinned?: boolean;
  onReply: (m: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  /** Delete for everyone (sender-only, server-enforced) */
  onDelete: (messageId: string) => void;
  /** Delete for me only (any participant) */
  onDeleteForMe: (messageId: string) => void;
  onCopy: (text: string) => void;
  /** Cancel in-flight upload (sender, pending) */
  onCancelSend?: (messageId: string) => void;
  onPin?: (m: ChatMessage) => void;
  onForward?: (m: ChatMessage) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<PopoverPos | null>(null);
  const [reactPos, setReactPos] = useState<PopoverPos | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleted = Boolean(message.deleted_at);
  const pending = Boolean(message.pending);
  const failed = Boolean(message.failed);

  const reactionGroups = groupReactions(message.reactions);
  const images = message.attachments.filter((a) => a.kind === "image" && a.url);
  const docs = message.attachments.filter((a) => a.kind === "document");
  const hasText = Boolean(message.body?.trim()) && message.message_type !== "sticker";
  const hasReply = Boolean(message.reply_preview) && !deleted;
  const isSticker = message.message_type === "sticker" && !deleted;
  const imageOnly =
    !deleted &&
    images.length > 0 &&
    !hasText &&
    docs.length === 0 &&
    !isSticker &&
    !hasReply;
  const imageWithText =
    !deleted && images.length > 0 && (hasText || docs.length > 0 || hasReply);
  const progress = message.upload_progress;

  useEffect(() => setMounted(true), []);

  const placePopover = useCallback(
    (approxHeight: number): PopoverPos | null => {
      const el = rootRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      // Leave room for fixed composer (~80px) + safe area
      const composerPad = 96;
      const spaceBelow = window.innerHeight - rect.bottom - composerPad;
      const openUp = spaceBelow < approxHeight;
      const gap = 6;
      const pos: PopoverPos = {};

      if (openUp) {
        pos.bottom = window.innerHeight - rect.top + gap;
      } else {
        pos.top = rect.bottom + gap;
      }

      if (mine) {
        pos.right = Math.max(8, window.innerWidth - rect.right);
      } else {
        pos.left = Math.max(8, rect.left);
      }
      return pos;
    },
    [mine],
  );

  const openMenu = useCallback(() => {
    if (deleted || pending) return;
    setMenuPos(placePopover(220));
    setMenu(true);
    setReactOpen(false);
    setReactPos(null);
  }, [deleted, pending, placePopover]);

  const openReact = useCallback(() => {
    if (deleted || pending) return;
    setReactPos(placePopover(56));
    setReactOpen(true);
    setMenu(false);
    setMenuPos(null);
  }, [deleted, pending, placePopover]);

  const closeAll = useCallback(() => {
    setMenu(false);
    setReactOpen(false);
    setMenuPos(null);
    setReactPos(null);
  }, []);

  useEffect(() => {
    if (!menu && !reactOpen) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      if (reactRef.current?.contains(t)) return;
      closeAll();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAll();
    }
    function onScroll() {
      // Reposition or close on scroll so menu never floats wrong
      closeAll();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    window.addEventListener("keydown", onKey);
    // Capture scroll from the thread list
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu, reactOpen, closeAll]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const radius = bubbleRadius(mine, cluster);

  return (
    <div
      ref={rootRef}
      className={cn(
        "group flex w-full",
        mine ? "justify-end" : "justify-start",
        cluster === "middle" || cluster === "last" ? "mt-0.5" : "mt-2.5",
      )}
    >
      <div className={cn("relative max-w-[78%]", mine ? "items-end" : "items-start")}>
        <div
          className={cn(
            "relative transition-opacity",
            radius,
            // Default bubble chrome
            !imageOnly &&
              !isSticker &&
              (mine
                ? "bg-[#007AFF] text-white dark:bg-[#0A84FF]"
                : "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]"),
            // Padding: none for pure images; mixed keeps image flush, body padded below
            imageOnly
              ? "overflow-hidden bg-transparent p-0 shadow-none ring-0"
              : imageWithText
                ? "overflow-hidden p-0"
                : isSticker
                  ? "bg-transparent p-1 shadow-none ring-0 dark:bg-transparent"
                  : "px-3 py-2",
            pending && "opacity-70",
            failed && "opacity-90 ring-1 ring-[#ff3b30]/50",
          )}
          onContextMenu={(e) => {
            if (deleted || pending) return;
            e.preventDefault();
            openMenu();
          }}
          onTouchStart={() => {
            if (deleted || pending) return;
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
            longPressTimer.current = setTimeout(() => {
              openMenu();
            }, 420);
          }}
          onTouchEnd={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }}
          onTouchMove={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }}
        >
          {message.forwarded && !deleted && (
            <p
              className={cn(
                "px-3 pt-2 text-[11px] italic",
                mine ? "text-white/60" : "text-muted-foreground",
                hasReply || imageOnly || isSticker ? "px-2" : "",
              )}
            >
              Reencaminhada
            </p>
          )}

          {hasReply && (
            <div
              className={cn(
                "mx-2 mt-2 w-[calc(100%-1rem)] rounded-lg border-l-[3px] px-2 py-1 text-left text-[12px]",
                mine
                  ? "border-l-white/80 bg-black/10"
                  : "border-l-[#007AFF] bg-black/[0.04] dark:bg-white/[0.06]",
              )}
            >
              <p
                className={cn(
                  "font-semibold",
                  mine ? "text-white/90" : "text-foreground/80",
                )}
              >
                {replyAuthorLabel(message, mine, peerName)}
              </p>
              <p
                className={cn(
                  "truncate",
                  mine ? "text-white/70" : "text-muted-foreground",
                )}
              >
                {message.reply_preview!.deleted
                  ? "Mensagem apagada"
                  : message.reply_preview!.body ||
                    typeLabel(message.reply_preview!.message_type)}
              </p>
            </div>
          )}

          {deleted ? (
            <p
              className={cn(
                "px-3 py-2 text-[14px] italic",
                mine ? "text-white/70" : "text-muted-foreground",
              )}
            >
              Esta mensagem foi apagada
            </p>
          ) : (
            <MessageBody
              message={message}
              mine={mine}
              imageOnly={imageOnly}
              imageWithText={imageWithText}
              time={timeLabel(message.created_at)}
              failed={failed}
              onOpenImage={(index) => {
                setLightboxIndex(index);
                setLightbox(true);
              }}
            />
          )}

          {/* Upload progress + cancel (WhatsApp: spinner while sending media) */}
          {pending && mine && (
            <div
              className={cn(
                "pointer-events-none absolute inset-0 z-[5] flex items-center justify-center",
                imageOnly ? "bg-black/35" : "bg-black/15",
              )}
            >
              <div className="pointer-events-auto flex flex-col items-center gap-2">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${((progress ?? 8) / 100) * 97} 97`}
                    />
                  </svg>
                  <button
                    type="button"
                    aria-label="Cancelar envio"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelSend?.(message.id);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                {typeof progress === "number" && (
                  <span className="text-[11px] font-medium tabular-nums text-white drop-shadow">
                    {progress}%
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Timestamp outside image for text / mixed; image-only overlays inside MessageBody */}
          {!deleted && !imageOnly && (
            <div
              className={cn(
                "flex items-center justify-end gap-1",
                imageWithText ? "px-3 pb-1.5 pt-0.5" : "mt-0.5",
                mine ? "text-white/70" : "text-muted-foreground",
              )}
            >
              {failed && (
                <span className="text-[10px] font-medium text-[#ff3b30]">
                  Falhou
                </span>
              )}
              {pending && typeof progress === "number" && !imageOnly && (
                <span className="text-[10px] tabular-nums">{progress}%</span>
              )}
              <span className="text-[10px] tabular-nums leading-none">
                {timeLabel(message.created_at)}
              </span>
            </div>
          )}
        </div>

        {reactionGroups.length > 0 && !deleted && (
          <div
            className={cn(
              "-mt-1.5 flex flex-wrap gap-1",
              mine ? "justify-end pr-1" : "justify-start pl-1",
            )}
          >
            {reactionGroups.map((g) => (
              <button
                key={g.emoji}
                type="button"
                onClick={() => onReact(message.id, g.emoji)}
                className="rounded-full border border-[var(--separator)] bg-[var(--elevated)] px-1.5 py-0.5 text-[12px] shadow-sm backdrop-blur-xl"
              >
                {g.emoji}
                {g.count > 1 ? (
                  <span className="ml-0.5 text-[10px] text-muted-foreground">
                    {g.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        {!deleted && !pending && (
          <button
            type="button"
            aria-label="Acoes da mensagem"
            onClick={() => {
              if (menu) closeAll();
              else openMenu();
            }}
            className={cn(
              "absolute top-1 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100",
              mine ? "-left-8" : "-right-8",
            )}
          >
            <SmilePlus
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={1.5}
            />
          </button>
        )}

        {mounted &&
          menu &&
          !deleted &&
          menuPos &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[90] min-w-[11rem] overflow-hidden rounded-2xl border border-[var(--separator)] bg-[var(--elevated)] py-1 shadow-xl backdrop-blur-xl"
              style={{
                top: menuPos.top,
                bottom: menuPos.bottom,
                left: menuPos.left,
                right: menuPos.right,
              }}
            >
              <MenuItem
                icon={<Reply className="h-4 w-4" strokeWidth={1.5} />}
                label="Responder"
                onClick={() => {
                  onReply(message);
                  closeAll();
                }}
              />
              <MenuItem
                icon={<SmilePlus className="h-4 w-4" strokeWidth={1.5} />}
                label="Reagir"
                onClick={() => {
                  openReact();
                }}
              />
              {message.body && message.message_type !== "sticker" && (
                <MenuItem
                  icon={<Copy className="h-4 w-4" strokeWidth={1.5} />}
                  label="Copiar"
                  onClick={() => {
                    onCopy(message.body!);
                    closeAll();
                  }}
                />
              )}
              {images[0]?.url && (
                <MenuItem
                  icon={<Download className="h-4 w-4" strokeWidth={1.5} />}
                  label="Guardar foto"
                  onClick={() => {
                    void downloadFromUrl(
                      images[0].url!,
                      images[0].file_name || "foto.jpg",
                    );
                    closeAll();
                  }}
                />
              )}
              {docs.length > 0 && (
                <MenuItem
                  icon={<Download className="h-4 w-4" strokeWidth={1.5} />}
                  label="Descarregar ficheiro"
                  onClick={() => {
                    void downloadAttachment(docs[0]);
                    closeAll();
                  }}
                />
              )}
              {onForward && (
                <MenuItem
                  icon={<Forward className="h-4 w-4" strokeWidth={1.5} />}
                  label="Reencaminhar"
                  onClick={() => {
                    onForward(message);
                    closeAll();
                  }}
                />
              )}
              {onPin && (
                <MenuItem
                  icon={<Pin className="h-4 w-4" strokeWidth={1.5} />}
                  label={pinned ? "Desafixar" : "Fixar"}
                  onClick={() => {
                    onPin(message);
                    closeAll();
                  }}
                />
              )}
              <MenuItem
                icon={<Trash2 className="h-4 w-4" strokeWidth={1.5} />}
                label="Apagar para mim"
                destructive
                onClick={() => {
                  onDeleteForMe(message.id);
                  closeAll();
                }}
              />
              {mine && (
                <MenuItem
                  icon={<Trash2 className="h-4 w-4" strokeWidth={1.5} />}
                  label="Apagar para todos"
                  destructive
                  onClick={() => {
                    onDelete(message.id);
                    closeAll();
                  }}
                />
              )}
            </div>,
            document.body,
          )}

        {mounted &&
          reactOpen &&
          !deleted &&
          reactPos &&
          createPortal(
            <div
              ref={reactRef}
              className="fixed z-[90] flex gap-0.5 rounded-full border border-[var(--separator)] bg-[var(--elevated)] px-2 py-1.5 shadow-xl backdrop-blur-xl"
              style={{
                top: reactPos.top,
                bottom: reactPos.bottom,
                left: reactPos.left,
                right: reactPos.right,
              }}
            >
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="rounded-full p-1.5 text-[20px] transition-transform active:scale-90 hover:bg-muted/80"
                  onClick={() => {
                    onReact(message.id, e);
                    closeAll();
                  }}
                >
                  {e}
                </button>
              ))}
            </div>,
            document.body,
          )}
      </div>

      {images.length > 0 && (
        <MediaLightbox
          media={images.map((img, i) => ({
            id: img.id,
            storage_path: img.storage_path,
            url: img.url!,
            position: i,
          }))}
          startIndex={lightboxIndex}
          open={lightbox}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

function MessageBody({
  message,
  mine,
  imageOnly,
  imageWithText,
  time,
  failed,
  onOpenImage,
}: {
  message: ChatMessage;
  mine: boolean;
  imageOnly: boolean;
  imageWithText: boolean;
  time: string;
  failed: boolean;
  onOpenImage: (index: number) => void;
}) {
  if (message.message_type === "sticker") {
    const sticker =
      message.body ||
      message.attachments.find((a) => a.kind === "sticker")?.file_name;
    return (
      <p className="select-none text-[56px] leading-none" aria-label="Sticker">
        {sticker}
      </p>
    );
  }

  const images = message.attachments.filter((a) => a.kind === "image");
  const docs = message.attachments.filter((a) => a.kind === "document");
  const audios = message.attachments.filter((a) => a.kind === "audio");

  if (
    message.message_type === "audio" ||
    (audios.length > 0 && images.length === 0 && docs.length === 0)
  ) {
    const audio = audios[0];
    return (
      <VoiceNote
        url={audio?.url ?? null}
        mine={mine}
        durationHint={audio?.duration_sec ?? null}
      />
    );
  }

  const gridClass =
    images.length === 1
      ? "grid-cols-1"
      : images.length === 2
        ? "grid-cols-2"
        : "grid-cols-2";

  // Full-bleed image block (image-only or top of mixed)
  const imageBlock =
    images.length > 0 ? (
      <div
        className={cn(
          "relative grid gap-px overflow-hidden bg-black/10",
          gridClass,
          // When mixed with text, square top corners of bubble already handle outer radius;
          // image-only inherits parent radius via overflow-hidden
          imageWithText && "rounded-none",
        )}
      >
        {images.slice(0, 4).map((image, index) => {
          if (!image.url) return null;
          return (
            <button
              key={image.id}
              type="button"
              onClick={() => onOpenImage(index)}
              className={cn(
                "relative block overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                images.length === 1 ? "min-h-[12rem]" : "aspect-square",
                images.length === 3 && index === 0 && "col-span-2 aspect-[2/1]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt=""
                className={cn(
                  "w-full object-cover",
                  images.length === 1 ? "max-h-80 min-h-[12rem]" : "h-full",
                )}
              />
              {images.length > 4 && index === 3 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[18px] font-semibold text-white">
                  +{images.length - 4}
                </span>
              ) : null}
            </button>
          );
        })}

        {imageOnly && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent px-2.5 pb-1.5 pt-8">
            <div className="flex items-center justify-end gap-1 text-white/90">
              {failed && (
                <span className="text-[10px] font-medium text-[#ff453a]">
                  Falhou
                </span>
              )}
              <span className="text-[10px] tabular-nums leading-none drop-shadow-sm">
                {time}
              </span>
            </div>
          </div>
        )}
      </div>
    ) : null;

  return (
    <div className={cn(imageOnly || imageWithText ? "" : "space-y-1.5")}>
      {imageBlock}

      {docs.length > 0 && (
        <div className={cn("space-y-1", imageWithText ? "px-3 pt-2" : "")}>
          {docs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} mine={mine} />
          ))}
        </div>
      )}

      {message.body ? (
        <p
          data-user-content
          className={cn(
            "whitespace-pre-wrap text-[15px] leading-[1.35] tracking-[-0.01em]",
            imageWithText ? "px-3 pt-2" : "",
            imageOnly ? "sr-only" : "",
          )}
        >
          {message.body}
        </p>
      ) : null}

      {message.link_preview && (message.link_preview.titulo || message.link_preview.imagem_url) && (
        <a
          href={message.link_preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "mt-1.5 block overflow-hidden rounded-xl border",
            imageWithText ? "mx-3 mb-2" : "",
            mine
              ? "border-white/20 bg-black/10"
              : "border-[var(--separator)] bg-muted/40",
          )}
        >
          {message.link_preview.imagem_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.link_preview.imagem_url}
              alt=""
              className="aspect-[1.91/1] w-full object-cover bg-black/10"
            />
          )}
          <div className="flex items-start gap-2 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-[11px]",
                  mine ? "text-white/60" : "text-muted-foreground",
                )}
              >
                {message.link_preview.dominio || domainFromUrl(message.link_preview.url)}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug">
                {message.link_preview.titulo || message.link_preview.url}
              </p>
            </div>
            <ExternalLink
              className={cn(
                "mt-0.5 h-3.5 w-3.5 shrink-0",
                mine ? "text-white/60" : "text-muted-foreground",
              )}
              strokeWidth={1.5}
            />
          </div>
        </a>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  destructive,
  icon,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] font-medium hover:bg-muted/60",
        destructive && "text-[#ff3b30]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function bubbleRadius(mine: boolean, cluster: string) {
  if (cluster === "single") {
    return mine ? "rounded-[18px] rounded-br-md" : "rounded-[18px] rounded-bl-md";
  }
  if (cluster === "first") {
    return mine ? "rounded-[18px] rounded-br-md" : "rounded-[18px] rounded-bl-md";
  }
  if (cluster === "middle") {
    return mine ? "rounded-[18px] rounded-r-md" : "rounded-[18px] rounded-l-md";
  }
  return mine ? "rounded-[18px] rounded-br-md" : "rounded-[18px] rounded-bl-md";
}

function replyAuthorLabel(
  message: ChatMessage,
  mine: boolean,
  peerName: string,
) {
  if (!message.reply_preview) return "";
  const parentIsMe =
    (mine && message.reply_preview.sender_id === message.sender_id) ||
    (!mine && message.reply_preview.sender_id !== message.sender_id);
  return parentIsMe ? "Tu" : peerName;
}

function typeLabel(type: string) {
  if (type === "image") return "Foto";
  if (type === "document") return "Documento";
  if (type === "sticker") return "Sticker";
  if (type === "audio") return "Audio";
  return "Mensagem";
}

/**
 * Voice note with full playback control (play/pause + seek).
 * Progress is a real range input — not a decorative bar.
 */
function VoiceNote({
  url,
  mine,
  durationHint,
}: {
  url: string | null;
  mine: boolean;
  durationHint: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationHint ?? 0);
  const seeking = useRef(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    function onTime() {
      if (!el || seeking.current) return;
      setCurrent(el.currentTime || 0);
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setDuration(el.duration);
      }
    }
    function onEnded() {
      setPlaying(false);
      setCurrent(0);
      if (el) el.currentTime = 0;
    }
    function onMeta() {
      if (el && Number.isFinite(el.duration) && el.duration > 0) {
        setDuration(el.duration);
      }
    }
    function onPlay() {
      setPlaying(true);
    }
    function onPause() {
      setPlaying(false);
    }

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [url]);

  async function toggle() {
    const el = audioRef.current;
    if (!el || !url) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    try {
      await el.play();
    } catch {
      setPlaying(false);
    }
  }

  function seekTo(ratio: number) {
    const el = audioRef.current;
    const dur = duration || el?.duration || 0;
    if (!el || !dur || !Number.isFinite(dur)) return;
    const t = Math.min(1, Math.max(0, ratio)) * dur;
    el.currentTime = t;
    setCurrent(t);
  }

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <div className="flex min-w-[13.5rem] max-w-[17rem] items-center gap-2.5 py-0.5">
      {url ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audioRef} src={url} preload="metadata" playsInline />
      ) : null}
      <button
        type="button"
        aria-label={playing ? "Pausar" : "Reproduzir"}
        disabled={!url}
        onClick={() => void toggle()}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40",
          mine ? "bg-white/20 text-white" : "bg-foreground/10 text-foreground",
        )}
      >
        {playing ? (
          <Pause className="h-4 w-4 fill-current" strokeWidth={0} />
        ) : (
          <Play className="h-4 w-4 translate-x-px fill-current" strokeWidth={0} />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          disabled={!url || duration <= 0}
          aria-label="Posicao do audio"
          onPointerDown={() => {
            seeking.current = true;
          }}
          onPointerUp={() => {
            seeking.current = false;
          }}
          onChange={(e) => {
            const r = Number(e.target.value);
            seeking.current = true;
            seekTo(r);
          }}
          onInput={(e) => {
            const r = Number((e.target as HTMLInputElement).value);
            seekTo(r);
          }}
          className={cn(
            "voice-seek h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:opacity-40",
            mine ? "bg-white/25" : "bg-foreground/15",
          )}
          style={
            {
              // Fill track up to thumb (webkit + fallback)
              background: mine
                ? `linear-gradient(to right, #fff ${progress * 100}%, rgba(255,255,255,0.25) ${progress * 100}%)`
                : `linear-gradient(to right, currentColor ${progress * 100}%, rgba(128,128,128,0.25) ${progress * 100}%)`,
            } as React.CSSProperties
          }
        />
        <div
          className={cn(
            "mt-1 flex justify-between text-[11px] tabular-nums",
            mine ? "text-white/70" : "text-muted-foreground",
          )}
        >
          <span>{formatDuration(current)}</span>
          <span>{formatDuration(duration || durationHint || 0)}</span>
        </div>
      </div>
    </div>
  );
}

function groupReactions(reactions: { emoji: string; user_id: string }[]) {
  const map = new Map<string, number>();
  for (const r of reactions) {
    map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
  }
  return [...map.entries()].map(([emoji, count]) => ({ emoji, count }));
}

/**
 * Document card — WhatsApp style: meta only, download on demand.
 * Never uses <a href=signed> (avoids auto-open/download).
 */
function DocumentCard({
  doc,
  mine,
}: {
  doc: ChatAttachment;
  mine: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onDownload() {
    setBusy(true);
    setErr(null);
    try {
      await downloadAttachment(doc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao descarregar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
        mine ? "bg-black/15" : "bg-muted/80",
      )}
    >
      <FileText
        className={cn(
          "h-8 w-8 shrink-0",
          mine ? "text-white/90" : "opacity-70",
        )}
        strokeWidth={1.5}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">
          {doc.file_name || "Documento"}
        </p>
        <p
          className={cn(
            "text-[11px]",
            mine ? "text-white/65" : "opacity-60",
          )}
        >
          {doc.size_bytes != null ? formatBytes(doc.size_bytes) : "Ficheiro"}
          {err ? ` · ${err}` : ""}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onDownload()}
        aria-label="Descarregar ficheiro"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
          mine
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-foreground/10 text-foreground hover:bg-foreground/15",
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <Download className="h-4 w-4" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}

/** Resolve signed URL if needed, then save (never auto). */
async function downloadAttachment(doc: ChatAttachment) {
  let url = doc.url;
  if (!url && doc.storage_path) {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("chat-media")
      .createSignedUrl(doc.storage_path, 120);
    url = data?.signedUrl ?? null;
  }
  if (!url) throw new Error("Ficheiro indisponivel.");
  await downloadFromUrl(url, doc.file_name || "ficheiro");
}
