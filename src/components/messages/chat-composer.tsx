"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  FileText,
  Image as ImageIcon,
  Mic,
  Plus,
  SendHorizontal,
  Smile,
  Square,
  Sticker,
  Trash2,
  X,
} from "lucide-react";

import { formatDuration, humanizeMicError, pickAudioMime } from "@/lib/chat/audio";
import { STICKER_PACK } from "@/lib/chat/types";
import type { ChatMessage } from "@/lib/chat/types";
import { messagePreview } from "@/lib/chat/preview";
import { cn } from "@/lib/utils";

const EMOJI_QUICK = [
  "😀", "😂", "❤️", "👍", "🙏", "🔥", "✨", "🎉",
  "😍", "😅", "👏", "💯", "🤝", "📚", "☕", "🚀",
];

const MAX_VOICE_SEC = 120;

/** Max files per message (WhatsApp-like batch). */
export const MAX_CHAT_ATTACHMENTS = 10;

export type PendingAttachment = {
  id: string;
  file: File;
  kind: "image" | "document" | "audio";
  previewUrl?: string;
  durationSec?: number;
};

export type ChatSendPayload = {
  body: string | null;
  type: "text" | "image" | "document" | "sticker" | "audio";
  replyToId: string | null;
  attachments?: PendingAttachment[];
  sticker?: string | null;
};

/**
 * WhatsApp-style composer:
 * + (anexos) | campo com emoji embutido | mic ⇄ enviar (morph)
 * Mic inicia gravação real (MediaRecorder + permissão do browser).
 */
export function ChatComposer({
  disabled,
  replyTo,
  onCancelReply,
  onSend,
}: {
  disabled?: boolean;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onSend: (payload: ChatSendPayload) => Promise<void>;
}) {
  const uid = useId();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const mimeRef = useRef({ mime: "audio/webm", ext: "webm" });
  /** When true, stop → discard instead of send */
  const discardOnStopRef = useRef(false);

  function revokeAll(list: PendingAttachment[]) {
    for (const p of list) {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    }
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearTimer();
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      stopTracks();
    };
  }, []);

  function inferType(
    files: PendingAttachment[],
  ): "text" | "image" | "document" | "audio" {
    if (!files.length) return "text";
    if (files.some((f) => f.kind === "audio")) return "audio";
    if (files.some((f) => f.kind === "image")) return "image";
    return "document";
  }

  async function submit() {
    const body = text.trim();
    if (!body && pending.length === 0) return;
    setLoading(true);
    try {
      await onSend({
        body: body || null,
        type: inferType(pending),
        replyToId: replyTo?.id ?? null,
        attachments: pending.length ? pending : undefined,
      });
      setText("");
      revokeAll(pending);
      setPending([]);
      setEmojiOpen(false);
      setStickerOpen(false);
      setAttachOpen(false);
      if (taRef.current) taRef.current.style.height = "auto";
    } finally {
      setLoading(false);
    }
  }

  async function sendAudioBlob(blob: Blob, durationSec: number) {
    const { mime, ext } = mimeRef.current;
    const type = blob.type || mime || "audio/webm";
    const file = new File([blob], `audio-${Date.now()}.${ext}`, { type });
    const previewUrl = URL.createObjectURL(blob);

    setLoading(true);
    try {
      await onSend({
        body: null,
        type: "audio",
        replyToId: replyTo?.id ?? null,
        attachments: [
          {
            id: `${uid}-audio-${Date.now()}`,
            file,
            kind: "audio",
            previewUrl,
            durationSec,
          },
        ],
      });
      URL.revokeObjectURL(previewUrl);
      setReplyClear();
    } catch {
      URL.revokeObjectURL(previewUrl);
    } finally {
      setLoading(false);
    }
  }

  function setReplyClear() {
    /* reply cleared by parent on send; keep local UI clean */
    setEmojiOpen(false);
    setStickerOpen(false);
    setAttachOpen(false);
  }

  async function sendSticker(s: string) {
    setLoading(true);
    try {
      await onSend({
        body: s,
        type: "sticker",
        replyToId: replyTo?.id ?? null,
        sticker: s,
      });
      setStickerOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    setMicError(null);
    if (disabled || loading || recording) return;
    if (typeof window === "undefined") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Este browser nao suporta gravacao de audio.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setMicError("Este browser nao suporta MediaRecorder.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mimeRef.current = pickAudioMime();
      const options = mimeRef.current.mime
        ? { mimeType: mimeRef.current.mime }
        : undefined;

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      discardOnStopRef.current = false;
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        clearTimer();
        stopTracks();
        setRecording(false);
        const discard = discardOnStopRef.current;
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeRef.current.mime || "audio/webm",
        });
        chunksRef.current = [];
        mediaRecorderRef.current = null;

        if (discard || blob.size < 200) {
          setRecSeconds(0);
          return;
        }
        void sendAudioBlob(blob, durationSec);
        setRecSeconds(0);
      };

      recorder.start(250);
      setRecording(true);
      setRecSeconds(0);
      setEmojiOpen(false);
      setStickerOpen(false);
      setAttachOpen(false);

      clearTimer();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setRecSeconds(elapsed);
        if (elapsed >= MAX_VOICE_SEC) {
          stopRecording(false);
        }
      }, 250);
    } catch (err) {
      stopTracks();
      setMicError(humanizeMicError(err));
      setRecording(false);
    }
  }

  function stopRecording(discard: boolean) {
    discardOnStopRef.current = discard;
    clearTimer();
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        stopTracks();
        setRecording(false);
      }
    } else {
      stopTracks();
      setRecording(false);
      setRecSeconds(0);
    }
  }

  function addFiles(files: FileList | File[], kind: "image" | "document") {
    const list = Array.from(files);
    if (!list.length) return;

    setPending((prev) => {
      const room = MAX_CHAT_ATTACHMENTS - prev.length;
      if (room <= 0) return prev;

      const next: PendingAttachment[] = [...prev];
      for (const file of list.slice(0, room)) {
        if (kind === "image" && !file.type.startsWith("image/")) continue;
        next.push({
          id: `${uid}-${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          kind,
          previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
        });
      }
      return next;
    });
    setAttachOpen(false);
  }

  function removePending(id: string) {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function clearPending() {
    setPending((prev) => {
      revokeAll(prev);
      return [];
    });
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function insertEmoji(e: string) {
    setText((t) => t + e);
    requestAnimationFrame(() => taRef.current?.focus());
  }

  useEffect(() => {
    if (!attachOpen && !emojiOpen && !stickerOpen) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setAttachOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [attachOpen, emojiOpen, stickerOpen]);

  const hasContent = Boolean(text.trim() || pending.length);
  const canSend = hasContent && !loading && !disabled;
  const atLimit = pending.length >= MAX_CHAT_ATTACHMENTS;

  return (
    <div
      ref={rootRef}
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--separator)] bg-[var(--elevated)] backdrop-blur-xl backdrop-saturate-150"
    >
      <div className="mx-auto w-full max-w-lg pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {replyTo && !recording && (
          <div className="flex items-start gap-2 border-b border-[var(--separator)] px-3 py-2.5">
            <div className="min-w-0 flex-1 border-l-[3px] border-l-[#007AFF] pl-2.5">
              <p className="text-[12px] font-semibold tracking-[-0.01em] text-[#007AFF]">
                A responder
              </p>
              <p className="truncate text-[13px] text-muted-foreground">
                {messagePreview(replyTo)}
              </p>
            </div>
            <button
              type="button"
              aria-label="Cancelar resposta"
              onClick={onCancelReply}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        )}

        {micError && (
          <div className="border-b border-[var(--separator)] px-4 py-2.5">
            <p className="text-[12px] leading-relaxed text-[#ff3b30]" role="alert">
              {micError}
            </p>
          </div>
        )}

        {pending.length > 0 && !recording && (
          <div className="border-b border-[var(--separator)] px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[12px] font-medium text-muted-foreground">
                {pending.length}{" "}
                {pending.length === 1 ? "anexo" : "anexos"}
                {atLimit ? " (max.)" : ""}
              </p>
              <button
                type="button"
                onClick={clearPending}
                className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
              >
                Limpar
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {pending.map((p) => (
                <div key={p.id} className="relative shrink-0">
                  {p.kind === "image" && p.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.previewUrl}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/5"
                    />
                  ) : (
                    <div className="flex h-16 w-[9.5rem] items-center gap-2 rounded-xl bg-muted px-2.5">
                      <FileText
                        className="h-5 w-5 shrink-0 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                      <span className="min-w-0 truncate text-[12px] leading-tight">
                        {p.file.name}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label="Remover anexo"
                    onClick={() => removePending(p.id)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm"
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emoji / stickers */}
        {!recording && (
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
              emojiOpen || stickerOpen
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              {emojiOpen && (
                <div className="flex flex-wrap gap-0.5 border-b border-[var(--separator)] px-3 py-2">
                  {EMOJI_QUICK.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="rounded-xl p-1.5 text-[22px] transition-colors hover:bg-muted"
                      onClick={() => insertEmoji(e)}
                    >
                      {e}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setStickerOpen(true);
                      setEmojiOpen(false);
                    }}
                    className="ml-1 flex items-center gap-1 rounded-xl px-2 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Sticker className="h-4 w-4" strokeWidth={1.5} />
                    Stickers
                  </button>
                </div>
              )}
              {stickerOpen && (
                <div className="grid grid-cols-6 gap-0.5 border-b border-[var(--separator)] px-3 py-2">
                  {STICKER_PACK.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={loading}
                      className="rounded-2xl p-2 text-[28px] transition-colors hover:bg-muted disabled:opacity-50"
                      onClick={() => sendSticker(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attach menu */}
        {!recording && (
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
              attachOpen
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <div className="flex gap-5 border-b border-[var(--separator)] px-5 py-3.5">
                <AttachOption
                  label="Galeria"
                  disabled={atLimit}
                  onClick={() => galleryRef.current?.click()}
                  tone="blue"
                >
                  <ImageIcon className="h-5 w-5" strokeWidth={1.5} />
                </AttachOption>
                <AttachOption
                  label="Camera"
                  disabled={atLimit}
                  onClick={() => cameraRef.current?.click()}
                  tone="green"
                >
                  <Camera className="h-5 w-5" strokeWidth={1.5} />
                </AttachOption>
                <AttachOption
                  label="Ficheiro"
                  disabled={atLimit}
                  onClick={() => docRef.current?.click()}
                  tone="muted"
                >
                  <FileText className="h-5 w-5" strokeWidth={1.5} />
                </AttachOption>
              </div>
            </div>
          </div>
        )}

        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="file-input-native"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files, "image");
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="file-input-native"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files, "image");
            e.target.value = "";
          }}
        />
        <input
          ref={docRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,application/pdf"
          multiple
          className="file-input-native"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files, "document");
            e.target.value = "";
          }}
        />

        {/* Recording bar */}
        {recording ? (
          <div className="flex items-center gap-2 px-2 py-2">
            <button
              type="button"
              aria-label="Cancelar gravacao"
              onClick={() => stopRecording(true)}
              className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#ff3b30] transition-colors hover:bg-[#ff3b30]/10"
            >
              <Trash2 className="h-5 w-5" strokeWidth={1.5} />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[22px] bg-[#ff3b30]/10 px-4 py-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff3b30] opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff3b30]" />
              </span>
              <span className="text-[15px] font-medium tabular-nums tracking-[-0.01em] text-[#ff3b30]">
                {formatDuration(recSeconds)}
              </span>
              <span className="truncate text-[13px] text-muted-foreground">
                A gravar…
              </span>
            </div>

            <button
              type="button"
              aria-label="Parar e enviar"
              disabled={loading}
              onClick={() => stopRecording(false)}
              className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#007AFF] text-white transition-opacity disabled:opacity-50 dark:bg-[#0A84FF]"
            >
              <Square className="h-4 w-4 fill-current" strokeWidth={0} />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5 px-2 py-2">
            <button
              type="button"
              aria-label="Anexar"
              aria-expanded={attachOpen}
              disabled={loading || disabled}
              onClick={() => {
                setAttachOpen((v) => !v);
                setEmojiOpen(false);
                setStickerOpen(false);
              }}
              className={cn(
                "mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-200",
                "hover:bg-muted hover:text-foreground",
                attachOpen && "rotate-45 bg-muted text-foreground",
              )}
            >
              <Plus className="h-6 w-6" strokeWidth={1.5} />
            </button>

            <div className="relative min-w-0 flex-1">
              <textarea
                ref={taRef}
                rows={1}
                value={text}
                disabled={loading || disabled}
                onChange={(e) => {
                  setText(e.target.value);
                  autoGrow(e.target);
                  if (micError) setMicError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder="Mensagem"
                className="max-h-[120px] min-h-[44px] w-full resize-none rounded-[22px] border-0 bg-muted/80 py-2.5 pl-4 pr-11 text-[15px] leading-[1.35] tracking-[-0.01em] outline-none ring-0 placeholder:text-muted-foreground focus:bg-muted"
              />
              <button
                type="button"
                aria-label="Emoji"
                aria-expanded={emojiOpen}
                onClick={() => {
                  setEmojiOpen((v) => !v);
                  setStickerOpen(false);
                  setAttachOpen(false);
                }}
                className={cn(
                  "absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
                  "hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10",
                  emojiOpen && "text-foreground",
                )}
              >
                <Smile className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Mic ⇄ Send morph */}
            <button
              type="button"
              aria-label={hasContent ? "Enviar" : "Gravar audio"}
              disabled={hasContent ? !canSend : loading || disabled}
              onClick={() => {
                if (hasContent) void submit();
                else void startRecording();
              }}
              className={cn(
                "relative mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-200 ease-out",
                hasContent
                  ? "bg-[#007AFF] text-white dark:bg-[#0A84FF]"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground active:scale-95",
                hasContent && !canSend && "opacity-35",
              )}
            >
              <Mic
                className={cn(
                  "absolute h-5 w-5 transition-all duration-200 ease-out",
                  hasContent ? "scale-50 opacity-0" : "scale-100 opacity-100",
                )}
                strokeWidth={1.75}
                aria-hidden
              />
              <SendHorizontal
                className={cn(
                  "absolute h-5 w-5 transition-all duration-200 ease-out",
                  hasContent ? "scale-100 opacity-100" : "scale-50 opacity-0",
                )}
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AttachOption({
  label,
  onClick,
  disabled,
  children,
  tone,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  tone: "blue" | "green" | "muted";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-[#007AFF]/12 text-[#007AFF]"
      : tone === "green"
        ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
        : "bg-muted text-foreground";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-opacity disabled:opacity-40"
    >
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95",
          toneClass,
        )}
      >
        {children}
      </span>
      {label}
    </button>
  );
}
