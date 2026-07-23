"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import Image from "next/image";

import {
  AVATAR_CHANGED_EVENT,
  type AvatarChangedDetail,
  readCachedAvatar,
  withAvatarCacheBust,
} from "@/lib/profile/avatar";
import { PulseLoader } from "@/components/ui/pulse-loader";
import { uploadProfileAvatar } from "@/lib/profile/upload-avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function ProfileAvatar({
  userId,
  avatarUrl,
  name,
  isOwn,
  size = 76,
}: {
  userId: string;
  avatarUrl: string | null;
  name: string;
  isOwn: boolean;
  size?: number;
}) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(() => {
    const cached = readCachedAvatar(userId);
    if (cached) return withAvatarCacheBust(cached.url, cached.version);
    return withAvatarCacheBust(avatarUrl, null);
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const cached = readCachedAvatar(userId);
    if (cached) {
      setUrl(withAvatarCacheBust(cached.url, cached.version));
      return;
    }
    setUrl(withAvatarCacheBust(avatarUrl, null));
  }, [avatarUrl, userId]);

  useEffect(() => {
    function onChange(e: Event) {
      const d = (e as CustomEvent<AvatarChangedDetail>).detail;
      if (!d || d.userId !== userId) return;
      setUrl(withAvatarCacheBust(d.avatarUrl, d.version));
    }
    window.addEventListener(AVATAR_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(AVATAR_CHANGED_EVENT, onChange);
  }, [userId]);

  useEffect(() => {
    if (!sheetOpen && !lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSheetOpen(false);
        setLightboxOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen, lightboxOpen]);

  const initial = (name || "?").slice(0, 1).toUpperCase();
  const hasPhoto = Boolean(url);
  const clickable = isOwn || hasPhoto;

  function onAvatarClick() {
    if (isOwn) {
      setError(null);
      setSheetOpen(true);
      return;
    }
    if (hasPhoto) setLightboxOpen(true);
  }

  async function onFile(file: File | null) {
    if (!file) return;

    setLoading(true);
    setError(null);
    const local = URL.createObjectURL(file);
    setUrl(local);
    setSheetOpen(false);

    try {
      const supabase = createClient();
      const { url: next } = await uploadProfileAvatar(supabase, userId, file);
      setUrl(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
      setUrl(withAvatarCacheBust(avatarUrl, null));
      setSheetOpen(true);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={!clickable || loading}
        onClick={onAvatarClick}
        aria-label={
          isOwn
            ? "Foto de perfil"
            : hasPhoto
              ? "Ver foto de perfil"
              : "Sem foto de perfil"
        }
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full bg-muted text-[22px] font-semibold tracking-tight text-muted-foreground ring-1 ring-[var(--separator)]",
          clickable &&
            "transition-opacity hover:opacity-90 active:opacity-80",
          (!clickable || loading) && "cursor-default disabled:opacity-100",
        )}
        style={{ width: size, height: size }}
      >
        {url ? (
          <Image
            src={url}
            alt=""
            fill
            className="object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            {initial}
          </span>
        )}
      </button>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="file-input-native"
        tabIndex={-1}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      {mounted &&
        sheetOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
            <button
              type="button"
              aria-label="Fechar"
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setSheetOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Foto de perfil"
              className="relative z-10 w-full max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3"
            >
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--separator)] bg-[var(--elevated)] shadow-xl backdrop-blur-xl">
                {error && (
                  <p className="border-b border-[var(--separator)] px-4 py-3 text-center text-[13px] text-destructive">
                    {error}
                  </p>
                )}
                <ul className="divide-y divide-[var(--separator)]">
                  {hasPhoto && (
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setSheetOpen(false);
                          setLightboxOpen(true);
                        }}
                        className="flex w-full items-center justify-center px-4 py-3.5 text-[16px] font-medium tracking-[-0.02em] transition-all duration-200 ease-out hover:bg-muted/60 active:scale-95"
                      >
                        Ver foto
                      </button>
                    </li>
                  )}
                  <li>
                    <label
                      htmlFor={inputId}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-center px-4 py-3.5 text-[16px] font-medium tracking-[-0.02em] transition-all duration-200 ease-out hover:bg-muted/60 active:scale-95",
                        loading && "pointer-events-none opacity-50",
                      )}
                    >
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                          <PulseLoader size="sm" />
                          A enviar...
                        </span>
                      ) : (
                        "Alterar foto"
                      )}
                    </label>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setSheetOpen(false)}
                      className="flex w-full items-center justify-center px-4 py-3.5 text-[16px] font-normal tracking-[-0.02em] text-muted-foreground transition-all duration-200 ease-out hover:bg-muted/60 active:scale-95"
                    >
                      Cancelar
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {mounted &&
        lightboxOpen &&
        url &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Foto de perfil"
            className="fixed inset-0 z-[100] flex flex-col bg-black/95"
            onClick={() => setLightboxOpen(false)}
          >
            <div className="flex h-12 shrink-0 items-center justify-between px-3">
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                aria-label="Fechar"
                className="rounded-full p-2 text-white/90 hover:bg-white/10"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <span className="w-9" />
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-8">
              <Image
                src={url}
                alt=""
                fill
                className="object-contain"
                draggable={false}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
