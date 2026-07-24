"use client";

import { useState } from "react";
import Image from "next/image";
import { Pencil, Plus, X } from "lucide-react";

export type ComposeImage = {
  key: string;
  file: File;
  previewUrl: string;
};

/**
 * Preview fluido das imagens da publicacao.
 * 1 imagem: destaque grande. Varias: galeria horizontal reordenavel
 * (drag nativo — sem lib extra para um caso de poucos itens).
 */
export function ImageStrip({
  images,
  maxImages,
  onAddMore,
  onRemove,
  onEdit,
  onReorder,
}: {
  images: ComposeImage[];
  maxImages: number;
  onAddMore: () => void;
  onRemove: (index: number) => void;
  onEdit: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-muted">
        <Image
          src={images[0].previewUrl}
          alt=""
          width={600}
          height={600}
          className="max-h-[420px] w-full object-contain"
          draggable={false}
        />
        <ImageActions
          onEdit={() => onEdit(0)}
          onRemove={() => onRemove(0)}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {images.map((img, i) => (
        <div
          key={img.key}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i);
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
          className="relative h-32 w-32 shrink-0 cursor-grab overflow-hidden rounded-xl bg-muted active:cursor-grabbing"
          style={{ opacity: dragIndex === i ? 0.5 : 1 }}
        >
          <Image
            src={img.previewUrl}
            alt=""
            width={128}
            height={128}
            className="h-full w-full object-cover"
            draggable={false}
          />
          <ImageActions onEdit={() => onEdit(i)} onRemove={() => onRemove(i)} />
        </div>
      ))}

      {images.length < maxImages && (
        <button
          type="button"
          onClick={onAddMore}
          aria-label="Adicionar mais fotos"
          className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted/60"
        >
          <Plus className="h-6 w-6" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

function ImageActions({
  onEdit,
  onRemove,
}: {
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="absolute right-1 top-1 flex gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label="Editar imagem"
        className="rounded-full bg-black/60 p-1.5 text-white transition-transform active:scale-90"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover imagem"
        className="rounded-full bg-black/60 p-1.5 text-white transition-transform active:scale-90"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
