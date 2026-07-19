"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";

import { MentionField } from "@/components/compose/mention-field";
import { Spinner } from "@/components/ui/spinner";
import {
  maxPostImages,
  uploadPostImages,
  validateImageFile,
} from "@/lib/posts/media";
import { createClient } from "@/lib/supabase/client";

/**
 * Single-screen compose (Instagram create, simplified).
 * Media optional + caption + publish. See docs/UX_PATTERNS.md §2.
 */
export function ComposeForm({
  canHighlight = false,
  highlightWeeklyLimit = 3,
}: {
  canHighlight?: boolean;
  /** Orgs: 3 default, 6 if verified seal active. */
  highlightWeeklyLimit?: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [highlight, setHighlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onPickFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: File[] = [...files];
    const nextPrev: string[] = [...previews];
    for (const file of Array.from(list)) {
      const err = validateImageFile(file);
      if (err) {
        setError(err);
        continue;
      }
      if (next.length >= maxPostImages()) {
        setError(`No máximo ${maxPostImages()} imagens.`);
        break;
      }
      next.push(file);
      nextPrev.push(URL.createObjectURL(file));
    }
    setFiles(next);
    setPreviews(nextPrev);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index]);
    setFiles((f) => f.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text && files.length === 0) {
      setError("Escreve algo ou adiciona uma foto.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      const { data: post, error: insertError } = await supabase
        .from("posts")
        .insert({
          author_id: user.id,
          body: text || null,
          is_highlighted: canHighlight ? highlight : false,
        })
        .select("id")
        .single();

      if (insertError || !post) throw insertError ?? new Error("Falha ao criar.");

      if (files.length) {
        await uploadPostImages(supabase, user.id, post.id, files);
      }

      // Unfurl once after publish (cached). Failures leave clickable URLs only.
      if (text) {
        void fetch("/api/posts/link-previews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: post.id }),
        }).catch(() => {});
      }

      setBody("");
      setFiles([]);
      setPreviews([]);
      setHighlight(false);
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível publicar.",
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
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
        placeholder="O que queres partilhar? Usa @ para mencionar"
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
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
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
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
            Foto
          </button>
        </div>
        <button
          type="submit"
          disabled={loading || (!body.trim() && files.length === 0)}
          className="flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Spinner className="h-3.5 w-3.5" />}
          {loading ? "A publicar..." : "Publicar"}
        </button>
      </div>
    </form>
  );
}
