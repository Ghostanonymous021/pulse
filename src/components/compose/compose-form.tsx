"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import Image from "next/image";

import { MentionField } from "@/components/compose/mention-field";
import { PulseLoader } from "@/components/ui/pulse-loader";
import { compressImageForUpload } from "@/lib/posts/compress-image";
import type { UploadableImage } from "@/lib/posts/media";
import {
  maxPostImages,
  uploadPostImages,
  validateImageFile,
} from "@/lib/posts/media";
import { createClient } from "@/lib/supabase/client";

export function ComposeForm({
  canHighlight = false,
  highlightWeeklyLimit = 3,
}: {
  canHighlight?: boolean;
  highlightWeeklyLimit?: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [images, setImages] = useState<UploadableImage[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [highlight, setHighlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPickFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: UploadableImage[] = [...images];
    const nextPrev: string[] = [...previews];
    for (const raw of Array.from(list)) {
      const err = validateImageFile(raw);
      if (err) {
        setError(err);
        continue;
      }
      if (next.length >= maxPostImages()) {
        setError(`Ate ${maxPostImages()} imagens por publicacao.`);
        break;
      }
      const result = await compressImageForUpload(raw);
      if (!result.compressed && result.file.size > 700 * 1024) {
        // Compression was skipped and the file is still large -- surfaced
        // so we're not silently shipping full camera-res photos again.
        console.warn(
          "[compose] client-side compression skipped for large file",
          { name: raw.name, size: raw.size, type: raw.type },
        );
      }
      next.push({
        file: result.file,
        width: result.width,
        height: result.height,
      });
      nextPrev.push(URL.createObjectURL(result.file));
    }
    setImages(next);
    setPreviews(nextPrev);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index]);
    setImages((f) => f.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text && images.length === 0) {
      setError("Escreve algo ou adiciona uma foto para partilhar.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("A tua sessao expirou. Entra outra vez.");

      const { data: post, error: insertError } = await supabase
        .from("posts")
        .insert({
          author_id: user.id,
          body: text || null,
          is_highlighted: canHighlight ? highlight : false,
        })
        .select("id")
        .single();

      if (insertError || !post) throw insertError ?? new Error("Nao foi possivel publicar. Tenta outra vez.");

      if (images.length) {
        await uploadPostImages(supabase, user.id, post.id, images);
      }

      if (text) {
        void fetch("/api/posts/link-previews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: post.id }),
        }).catch(() => {});
      }

      setBody("");
      setImages([]);
      setPreviews([]);
      setHighlight(false);
      // Drop stale feed snapshot so home shows the new post
      const { bustFeedCache } = await import("@/components/feed/feed-list");
      bustFeedCache();
      router.push("/home");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível publicar. Tenta outra vez.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-4">
      {previews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {previews.map((src, i) => (
            <div
              key={src}
              className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-muted"
            >
              <Image
                src={src}
                alt="Preview"
                className="h-full w-full object-cover"
                draggable={false}
                width={112}
                height={112}
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                aria-label="Remover imagem"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      <MentionField
        rows={5}
        value={body}
        onChange={setBody}
        placeholder="O que tens em mente? Usa @ para mencionar alguem"
        maxLength={5000}
        className="w-full resize-none rounded-xl border border-border bg-card p-4 text-sm outline-none ring-foreground/10 placeholder:text-muted-foreground focus:ring-2"
      />

      {canHighlight && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(e) => setHighlight(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Destacar (ate {highlightWeeklyLimit}/semana)
        </label>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="file-input-native"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 ease-out hover:bg-muted hover:text-foreground active:scale-95"
          >
            <ImagePlus className="h-5 w-5" strokeWidth={1.5} />
            Foto
          </button>
        </div>
        <button
          type="submit"
          disabled={loading || (!body.trim() && images.length === 0)}
           className="flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-accent-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95 disabled:opacity-50"
        >
          {loading && <PulseLoader size="sm" />}
          {loading ? "A publicar..." : "Publicar"}
        </button>
      </div>
    </form>
  );
}
