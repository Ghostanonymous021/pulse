"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

const MAX = 5 * 1024 * 1024;

/**
 * Edit-profile avatar — label opens system gallery (works on iOS/Android).
 */
export function AvatarPicker({
  userId,
  avatarUrl,
  name,
}: {
  userId: string;
  avatarUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
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
    setPreview(local);

    try {
      const supabase = createClient();
      let contentType = type || "image/jpeg";
      let ext = "jpg";
      if (type === "image/png" || /\.png$/i.test(file.name)) {
        contentType = "image/png";
        ext = "png";
      } else if (type === "image/webp" || /\.webp$/i.test(file.name)) {
        contentType = "image/webp";
        ext = "webp";
      } else if (/heic|heif/i.test(type) || /\.heic$/i.test(file.name)) {
        contentType = type || "image/heic";
        ext = "heic";
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
      const url = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userId);
      if (pErr) throw pErr;

      setPreview(url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
      setPreview(avatarUrl);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <label
        htmlFor={inputId}
        className="relative h-24 w-24 cursor-pointer overflow-hidden rounded-full bg-muted ring-1 ring-[var(--separator)] has-[:disabled]:opacity-60"
        aria-label="Alterar foto de perfil"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[28px] font-semibold text-muted-foreground">
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
        <p className="text-[12px] text-[#ff3b30]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
