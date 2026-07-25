"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X, RotateCw, Check } from "lucide-react";
import Cropper from "react-easy-crop";

import { MentionField } from "@/components/compose/mention-field";
import { Spinner } from "@/components/ui/spinner";
import {
  maxPostImages,
  uploadPostImages,
  validateImageFile,
} from "@/lib/posts/media";
import { createClient } from "@/lib/supabase/client";

interface CroppedArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageToCrop {
  file: File;
  preview: string;
  crop: { x: number; y: number };
  zoom: number;
  croppedAreaPixels: CroppedArea | null;
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
  const [images, setImages] = useState<ImageToCrop[]>([]);
  const [highlight, setHighlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentCropIndex, setCurrentCropIndex] = useState<number | null>(null);

  // Abrir seletor de arquivos
  function openFilePicker() {
    fileRef.current?.click();
  }

  // Adicionar novas fotos
  function onPickFiles(list: FileList | null) {
    if (!list?.length) return;

    const nextImages: ImageToCrop[] = [...images];
    let added = 0;

    for (const file of Array.from(list)) {
      const err = validateImageFile(file);
      if (err) {
        setError(err);
        continue;
      }
      if (nextImages.length + added >= maxPostImages()) {
        setError(`Máximo de ${maxPostImages()} imagens.`);
        break;
      }

      const preview = URL.createObjectURL(file);
      nextImages.push({
        file,
        preview,
        crop: { x: 0, y: 0 },
        zoom: 1,
        croppedAreaPixels: null,
      });
      added++;
    }

    setImages(nextImages);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Remover imagem
  function removeImage(index: number) {
    const img = images[index];
    URL.revokeObjectURL(img.preview);
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);

    if (currentCropIndex === index) {
      setCurrentCropIndex(null);
    } else if (currentCropIndex !== null && currentCropIndex > index) {
      setCurrentCropIndex(currentCropIndex - 1);
    }
  }

  // Abrir editor de corte
  function openCropper(index: number) {
    setCurrentCropIndex(index);
    setError(null);
  }

  // Fechar editor de corte
  function closeCropper() {
    setCurrentCropIndex(null);
  }

  // Atualizar parâmetros do cropper
  function updateCrop(index: number, crop: { x: number; y: number }, zoom: number) {
    setImages((prev) =>
      prev.map((img, i) =>
        i === index ? { ...img, crop, zoom } : img
      )
    );
  }

  // Salvar área cortada
  function onCropComplete(index: number, croppedArea: any, croppedAreaPixels: CroppedArea) {
    setImages((prev) =>
      prev.map((img, i) =>
        i === index ? { ...img, croppedAreaPixels } : img
      )
    );
  }

  // Publicar
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();

    if (!text && images.length === 0) {
      setError("Escreve algo ou adiciona fotos.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      // Criar post
      const { data: post, error: insertError } = await supabase
        .from("posts")
        .insert({
          author_id: user.id,
          body: text || null,
          is_highlighted: canHighlight ? highlight : false,
        })
        .select("id")
        .single();

      if (insertError || !post) throw insertError ?? new Error("Falha ao criar publicação.");

      // Upload das imagens (com crop se existir)
      if (images.length > 0) {
        const filesToUpload = images.map((img) => img.file);
        await uploadPostImages(supabase, user.id, post.id, filesToUpload);
      }

      // Link preview (se houver texto)
      if (text) {
        void fetch("/api/posts/link-previews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: post.id }),
        }).catch(() => {});
      }

      // Limpar estado
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      setBody("");
      setImages([]);
      setHighlight(false);
      setCurrentCropIndex(null);

      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível publicar.");
    } finally {
      setLoading(false);
    }
  }

  const currentImage = currentCropIndex !== null ? images[currentCropIndex] : null;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)]">
      {/* Editor de corte (modal) */}
      {currentImage && currentCropIndex !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <button
              onClick={closeCropper}
              className="text-sm text-white/70 hover:text-white"
            >
              Cancelar
            </button>
            <div className="text-sm font-medium text-white">Ajustar foto</div>
            <button
              onClick={closeCropper}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1 text-sm font-medium text-black"
            >
              <Check className="h-4 w-4" /> Guardar
            </button>
          </div>

          <div className="relative flex-1 bg-black">
            <Cropper
              image={currentImage.preview}
              crop={currentImage.crop}
              zoom={currentImage.zoom}
              aspect={1}
              cropShape="rect"
              showGrid={true}
              onCropChange={(crop) => updateCrop(currentCropIndex, crop, currentImage.zoom)}
              onZoomChange={(zoom) => updateCrop(currentCropIndex, currentImage.crop, zoom)}
              onCropComplete={(_, croppedAreaPixels) =>
                onCropComplete(currentCropIndex, _, croppedAreaPixels)
              }
            />
          </div>

          <div className="flex items-center justify-center gap-6 border-t border-white/10 bg-black py-4">
            <button
              onClick={() => {
                const newZoom = Math.max(1, currentImage.zoom - 0.2);
                updateCrop(currentCropIndex, currentImage.crop, newZoom);
              }}
              className="rounded-full bg-white/10 p-3 text-white active:bg-white/20"
            >
              <RotateCw className="h-5 w-5" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={currentImage.zoom}
              onChange={(e) =>
                updateCrop(currentCropIndex, currentImage.crop, parseFloat(e.target.value))
              }
              className="w-40 accent-white"
            />
            <button
              onClick={() => {
                const newZoom = Math.min(3, currentImage.zoom + 0.2);
                updateCrop(currentCropIndex, currentImage.crop, newZoom);
              }}
              className="rounded-full bg-white/10 p-3 text-white active:bg-white/20"
            >
              <RotateCw className="h-5 w-5 rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* Formulário principal */}
      <form onSubmit={onSubmit} className="flex flex-1 flex-col p-4">
        {/* Preview das fotos */}
        {images.length > 0 && (
          <div className="mb-4 flex gap-3 overflow-x-auto pb-2">
            {images.map((img, index) => (
              <div
                key={index}
                className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted"
              >
                <img
                  src={img.preview}
                  alt={`Foto ${index + 1}`}
                  className="h-full w-full object-cover"
                />

                {/* Botões de ação */}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openCropper(index)}
                    className="rounded-full bg-white/90 p-1 text-black hover:bg-white"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="rounded-full bg-black/70 p-1 text-white hover:bg-black"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-px text-[10px] font-medium text-white">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Campo de texto */}
        <MentionField
          rows={6}
          value={body}
          onChange={setBody}
          placeholder="O que queres partilhar?"
          maxLength={5000}
          className="flex-1 resize-none rounded-2xl border border-border bg-card p-5 text-[15px] outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-foreground/10"
        />

        {/* Opções */}
        <div className="mt-4 space-y-3">
          {canHighlight && (
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={highlight}
                onChange={(e) => setHighlight(e.target.checked)}
                className="h-4 w-4 accent-foreground"
              />
              Destacar publicação (até {highlightWeeklyLimit}/semana)
            </label>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Barra de ações */}
        <div className="mt-auto flex items-center justify-between border-t pt-4">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={openFilePicker}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ImagePlus className="h-5 w-5" />
              Adicionar fotos
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || (!body.trim() && images.length === 0)}
            className="flex h-11 items-center gap-2 rounded-2xl bg-accent px-8 text-sm font-semibold text-accent-foreground transition active:opacity-90 disabled:opacity-50"
          >
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? "A publicar..." : "Publicar"}
          </button>
        </div>
      </form>
    </div>
  );
}
