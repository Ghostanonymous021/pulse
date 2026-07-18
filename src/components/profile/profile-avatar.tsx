"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX = 5 * 1024 * 1024;

/**
 * Profile photo:
 * - Own: sheet → Ver foto | Alterar foto (opens system gallery reliably)
 * - Other: lightbox if photo exists
 *
 * Gallery note: never use display:none on <input type=file> (iOS blocks .click()).
 * Use a <label htmlFor> so the OS treats it as a real user activation.
 */
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
  const [url, setUrl] = useState(avatarUrl);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setUrl(avatarUrl), [avatarUrl]);

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

    // Accept image/* from gallery; reject obvious non-images
    const type = file.type || "";
    const okType =
      type.startsWith("image/") ||
      /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
    if (!okType) {
      setError("Escolhe uma imagem da galeria.");
      return;
    }
    if (file.size > MAX) {
      setError("Maximo 5 MB.");
      return;
    }

    setLoading(true);
    setError(null);
    const local = URL.createObjectURL(file);
    setUrl(local);
    setSheetOpen(false);

    try {
      const supabase = createClient();
      // Normalize content-type for storage (HEIC may arrive as empty type)
      let contentType = type;
      let ext = "jpg";
      if (type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
        contentType = "image/png";
        ext = "png";
      } else if (
        type === "image/webp" ||
        file.name.toLowerCase().endsWith(".webp")
      ) {
        contentType = "image/webp";
        ext = "webp";
      } else if (
        type === "image/heic" ||
        type === "image/heif" ||
        /\.heic$/i.test(file.name)
      ) {
        // Prefer re-encode path: store as jpeg name; browser may still upload heic bytes
        contentType = type || "image/heic";
        ext = "heic";
      } else {
        contentType = type || "image/jpeg";
        ext = "jpg";
      }

      const path = `${userId}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          contentType,
          upsert: true,
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const next = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ avatar_url: next })
        .eq("id", userId);
      if (pErr) throw pErr;

      setUrl(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
      setUrl(avatarUrl);
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            {initial}
          </span>
        )}
      </button>

      {/* Native file picker — NOT display:none (breaks iOS gallery) */}
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
                  <p className="border-b border-[var(--separator)] px-4 py-3 text-center text-[13px] text-[#ff3b30]">
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
                        className="flex w-full items-center justify-center px-4 py-3.5 text-[16px] font-medium tracking-[-0.02em] transition-colors hover:bg-muted/60"
                      >
                        Ver foto
                      </button>
                    </li>
                  )}
                  <li>
                    {/* label → file input: most reliable way to open gallery on mobile */}
                    <label
                      htmlFor={inputId}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-center px-4 py-3.5 text-[16px] font-medium tracking-[-0.02em] transition-colors hover:bg-muted/60",
                        loading && "pointer-events-none opacity-50",
                      )}
                    >
                      {loading ? "A enviar..." : "Alterar foto"}
                    </label>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setSheetOpen(false)}
                      className="flex w-full items-center justify-center px-4 py-3.5 text-[16px] font-normal tracking-[-0.02em] text-muted-foreground transition-colors hover:bg-muted/60"
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="max-h-full max-w-full object-contain"
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
