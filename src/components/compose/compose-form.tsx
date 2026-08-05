"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock, ImagePlus, Star, X } from "lucide-react";

import { ImageEditorSheet } from "@/components/compose/image-editor-sheet";
import { ImageStrip, type ComposeImage } from "@/components/compose/image-strip";
import { LifespanSheet } from "@/components/compose/lifespan-sheet";
import { MentionField } from "@/components/compose/mention-field";
import { FixedBottomBar } from "@/components/ui/fixed-bottom-bar";
import { PulseLoader } from "@/components/ui/pulse-loader";
import {
  clearComposeDraft,
  loadComposeDraft,
  saveComposeDraft,
} from "@/lib/posts/draft";
import {
  describeLifespan,
  resolveExpiresAt,
  type LifespanPreset,
} from "@/lib/posts/lifespan";
import { compressImageForUpload } from "@/lib/posts/compress-image";
import {
  maxPostImages,
  uploadPostImages,
  validateImageFile,
} from "@/lib/posts/media";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

let nextKey = 0;
function makeKey() {
  nextKey += 1;
  return `img-${Date.now()}-${nextKey}`;
}

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
  const [images, setImages] = useState<ComposeImage[]>([]);
  const [editQueue, setEditQueue] = useState<{ key: string; file: File }[]>([]);
  const [reEditIndex, setReEditIndex] = useState<number | null>(null);
  const [lifespanPreset, setLifespanPreset] = useState<LifespanPreset>("permanent");
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [lifespanSheetOpen, setLifespanSheetOpen] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const draftReady = useRef(false);

  // Restore draft on mount (silent — no dialog, native "just there" feel).
  useEffect(() => {
    void (async () => {
      const draft = await loadComposeDraft();
      if (draft) {
        setBody(draft.body);
        setLifespanPreset(draft.lifespanPreset);
        setCustomDate(draft.customDate);
        setImages(
          draft.images.map((file) => ({
            key: makeKey(),
            file,
            previewUrl: URL.createObjectURL(file),
          })),
        );
      }
      draftReady.current = true;
    })();
  }, []);

  // Auto-save draft (debounced) whenever content changes after restore.
  useEffect(() => {
    if (!draftReady.current) return;
    const id = setTimeout(() => {
      void saveComposeDraft({
        body,
        lifespanPreset,
        customDate,
        images: images.map((i) => ({ file: i.file })),
      });
    }, 500);
    return () => clearTimeout(id);
  }, [body, lifespanPreset, customDate, images]);

  async function onPickFiles(list: FileList | null) {
    if (!list?.length) return;
    const room = maxPostImages() - images.length - editQueue.length;
    if (room <= 0) {
      setError(`Ate ${maxPostImages()} imagens por publicacao.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const accepted: { key: string; file: File }[] = [];
    for (const raw of Array.from(list).slice(0, room)) {
      const err = validateImageFile(raw);
      if (err) {
        setError(err);
        continue;
      }
      const result = await compressImageForUpload(raw);
      accepted.push({ key: makeKey(), file: result.file });
    }
    if (accepted.length) {
      setError(null);
      setEditQueue((q) => [...q, ...accepted]);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function reorderImages(from: number, to: number) {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function onEditorDone(edited: File) {
    if (reEditIndex != null) {
      setImages((prev) => {
        const next = [...prev];
        const old = next[reEditIndex];
        if (old) URL.revokeObjectURL(old.previewUrl);
        next[reEditIndex] = {
          key: old?.key ?? makeKey(),
          file: edited,
          previewUrl: URL.createObjectURL(edited),
        };
        return next;
      });
      setReEditIndex(null);
      return;
    }
    setImages((prev) => [
      ...prev,
      { key: makeKey(), file: edited, previewUrl: URL.createObjectURL(edited) },
    ]);
    setEditQueue((q) => q.slice(1));
  }

  function onEditorCancel() {
    if (reEditIndex != null) {
      setReEditIndex(null);
      return;
    }
    setEditQueue((q) => q.slice(1));
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

      const expiresAt = resolveExpiresAt(lifespanPreset, customDate);

      const { data: post, error: insertError } = await supabase
        .from("posts")
        .insert({
          author_id: user.id,
          body: text || null,
          is_highlighted: canHighlight ? highlight : false,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (insertError || !post) throw insertError ?? new Error("Nao foi possivel publicar. Tenta outra vez.");

      if (images.length) {
        await uploadPostImages(
          supabase,
          user.id,
          post.id,
          images.map((i) => ({ file: i.file })),
        );
      }

      if (text) {
        void fetch("/api/posts/link-previews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: post.id }),
        }).catch(() => {});
      }

      clearComposeDraft();
      for (const img of images) URL.revokeObjectURL(img.previewUrl);
      setBody("");
      setImages([]);
      setHighlight(false);
      setLifespanPreset("permanent");
      setCustomDate(null);

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

  const canPublish = (body.trim().length > 0 || images.length > 0) && !loading;
  const editingItem =
    reEditIndex != null
      ? images[reEditIndex]
        ? { key: images[reEditIndex].key, file: images[reEditIndex].file }
        : null
      : editQueue[0] ?? null;

  return (
    <form onSubmit={onSubmit} className="flex min-h-[100dvh] flex-col">
      {/* Top bar — cancelar / publicar, sem chrome de formulário */}
      <div
        data-app-chrome
        className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-[var(--separator)] bg-[var(--elevated)] px-3 backdrop-blur-xl backdrop-saturate-150"
      >
        <button
          type="button"
          aria-label="Cancelar"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 transition-all duration-200 ease-out hover:bg-muted active:scale-90"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <button
          type="submit"
          disabled={!canPublish}
          className="flex h-9 items-center gap-2 rounded-full bg-brand px-4 text-[14px] font-semibold text-brand-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95 disabled:bg-muted disabled:text-muted-foreground"
        >
          {loading && <PulseLoader size="sm" />}
          {loading ? "A publicar..." : "Publicar"}
        </button>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 pb-24">
        <div className="relative">
          <MentionField
            rows={4}
            autoGrow
            maxHeight={480}
            value={body}
            onChange={setBody}
            placeholder="O que tens em mente? Usa @ para mencionar alguem"
            maxLength={5000}
            autoFocus
            className="field-borderless w-full resize-none border-none bg-transparent text-[20px] font-normal leading-[1.4] tracking-[-0.015em] text-foreground antialiased caret-brand outline-none selection:bg-brand/20 placeholder:font-normal placeholder:text-muted-foreground/70"
          />
          {body.length > 4880 && (
            <span
              className={cn(
                "pointer-events-none absolute -bottom-1 right-0 translate-y-full text-[12px] font-medium tabular-nums transition-colors duration-200",
                body.length >= 5000 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {5000 - body.length}
            </span>
          )}
        </div>

        <ImageStrip
          images={images}
          maxImages={maxPostImages()}
          onAddMore={() => fileRef.current?.click()}
          onRemove={removeImage}
          onEdit={(i) => setReEditIndex(i)}
          onReorder={reorderImages}
        />

        {error && (
          <p
            className="flex w-fit items-center gap-1.5 rounded-full bg-destructive/15 px-3.5 py-2 text-[12.5px] font-medium text-destructive"
            role="alert"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {error}
          </p>
        )}
      </div>

      {/* Barra de acoes — minima: foto + tempo de vida (+ destaque p/ orgs) */}
      <FixedBottomBar innerClassName="flex items-center gap-1 px-3 py-2">
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
          aria-label="Adicionar foto"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 ease-out hover:bg-muted hover:text-foreground active:scale-90"
        >
          <ImagePlus className="h-5 w-5" strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={() => setLifespanSheetOpen(true)}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-all duration-200 ease-out active:scale-95",
            lifespanPreset === "permanent"
              ? "text-muted-foreground hover:bg-muted hover:text-foreground"
              : "bg-brand-soft text-brand",
          )}
        >
          <Clock className="h-[18px] w-[18px]" strokeWidth={1.5} />
          {lifespanPreset === "permanent"
            ? "Tempo de vida"
            : describeLifespan(lifespanPreset, customDate)}
        </button>

        {canHighlight && (
          <button
            type="button"
            onClick={() => setHighlight((v) => !v)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-all duration-200 ease-out active:scale-95",
              highlight
                ? "bg-brand-accent-soft text-brand-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            title={`Destacar (ate ${highlightWeeklyLimit}/semana)`}
          >
            <Star className="h-[18px] w-[18px]" strokeWidth={1.5} />
            Destaque
          </button>
        )}
      </FixedBottomBar>

      {editingItem && (
        <ImageEditorSheet
          key={editingItem.key}
          file={editingItem.file}
          onCancel={onEditorCancel}
          onDone={onEditorDone}
        />
      )}

      {lifespanSheetOpen && (
        <LifespanSheet
          value={lifespanPreset}
          customDate={customDate}
          onClose={() => setLifespanSheetOpen(false)}
          onConfirm={(preset, custom) => {
            setLifespanPreset(preset);
            setCustomDate(custom);
            setLifespanSheetOpen(false);
          }}
        />
      )}
    </form>
  );
}
