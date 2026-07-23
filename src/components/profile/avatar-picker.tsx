"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera } from "lucide-react";
import Image from "next/image";

import {
  AVATAR_CHANGED_EVENT,
  type AvatarChangedDetail,
  avatarFallbackTone,
  readCachedAvatar,
  withAvatarCacheBust,
} from "@/lib/profile/avatar";
import { uploadProfileAvatar } from "@/lib/profile/upload-avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function AvatarPicker({
  userId,
  avatarUrl,
  name,
}: {
  userId: string;
  avatarUrl: string | null;
  name: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(() => {
    const cached = readCachedAvatar(userId);
    if (cached) return withAvatarCacheBust(cached.url, cached.version);
    return withAvatarCacheBust(avatarUrl, null);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = readCachedAvatar(userId);
    if (cached) {
      setPreview(withAvatarCacheBust(cached.url, cached.version));
      return;
    }
    setPreview(withAvatarCacheBust(avatarUrl, null));
  }, [avatarUrl, userId]);

  useEffect(() => {
    function onChange(e: Event) {
      const d = (e as CustomEvent<AvatarChangedDetail>).detail;
      if (!d || d.userId !== userId) return;
      setPreview(withAvatarCacheBust(d.avatarUrl, d.version));
    }
    window.addEventListener(AVATAR_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(AVATAR_CHANGED_EVENT, onChange);
  }, [userId]);

  async function onFile(file: File | null) {
    if (!file) return;
    setLoading(true);
    setError(null);
    const local = URL.createObjectURL(file);
    setPreview(local);

    try {
      const supabase = createClient();
      const { url } = await uploadProfileAvatar(supabase, userId, file);
      setPreview(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
      setPreview(withAvatarCacheBust(avatarUrl, null));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <label
        htmlFor={inputId}
        className={cn(
          "relative h-24 w-24 cursor-pointer overflow-hidden rounded-full ring-1 ring-[var(--separator)] has-[:disabled]:opacity-60",
          !preview && avatarFallbackTone(userId),
        )}
        aria-label="Alterar foto de perfil"
      >
        {preview ? (
          <Image
            src={preview}
            alt=""
            fill
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[28px] font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/45 py-1 text-[11px] font-medium text-white">
          <Camera className="h-3 w-3" strokeWidth={1.75} />
          {loading ? "..." : "Foto"}
        </span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={loading}
          className="file-input-native"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {error && (
        <p className="text-[12px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
