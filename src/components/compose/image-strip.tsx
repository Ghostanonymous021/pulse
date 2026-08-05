"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Pencil, Plus, X } from "lucide-react";

export type ComposeImage = {
  key: string;
  file: File;
  previewUrl: string;
};

const LONG_PRESS_MS = 160;
const MOVE_CANCEL_PX = 8;

/**
 * Preview fluido das imagens da publicacao.
 * 1 imagem: destaque grande. Varias: galeria horizontal reordenavel.
 *
 * Reorder via Pointer Events (nao HTML5 drag-and-drop, que nao funciona
 * em ecras touch). Como a fila tambem faz scroll horizontal, um "long
 * press" curto (160ms) decide a intencao: toque rapido + arrasto vira
 * scroll normal da fila; premir e segurar ativa o modo de reordenar
 * (mesmo padrao do iOS/Android para reorganizar icones).
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
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef({ x: 0, y: 0 });
  const capturedEl = useRef<HTMLElement | null>(null);
  const capturedPointerId = useRef<number | null>(null);

  function clearPressTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function endDrag() {
    clearPressTimer();
    if (capturedEl.current && capturedPointerId.current != null) {
      capturedEl.current.releasePointerCapture(capturedPointerId.current);
    }
    capturedEl.current = null;
    capturedPointerId.current = null;
    setDragIndex(null);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, index: number) {
    if ((e.target as HTMLElement).closest("button")) return;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    pressTimer.current = setTimeout(() => {
      el.setPointerCapture(pointerId);
      capturedEl.current = el;
      capturedPointerId.current = pointerId;
      setDragIndex(index);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragIndex === null) {
      // Ainda dentro da janela de long-press: se moveu, e um scroll, cancela.
      if (pressTimer.current) {
        const dx = Math.abs(e.clientX - pressOrigin.current.x);
        const dy = Math.abs(e.clientY - pressOrigin.current.y);
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearPressTimer();
      }
      return;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = (el as HTMLElement | null)?.closest<HTMLElement>("[data-thumb-index]");
    if (!target) return;
    const targetIndex = Number(target.dataset.thumbIndex);
    if (!Number.isNaN(targetIndex) && targetIndex !== dragIndex) {
      onReorder(dragIndex, targetIndex);
      setDragIndex(targetIndex);
    }
  }

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-muted shadow-[0_2px_16px_rgba(0,0,0,0.25)] ring-1 ring-white/[0.06]">
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
    <div>
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <p className="text-[12px] font-medium text-muted-foreground">
          Prime e segura para reordenar
        </p>
        <p className="text-[12px] font-medium tabular-nums text-muted-foreground">
          {images.length}/{maxImages}
        </p>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {images.map((img, i) => (
          <div
            key={img.key}
            data-thumb-index={i}
            onPointerDown={(e) => handlePointerDown(e, i)}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="relative h-32 w-32 shrink-0 cursor-grab select-none overflow-hidden rounded-2xl bg-muted shadow-[0_2px_12px_rgba(0,0,0,0.25)] ring-1 ring-white/[0.06] transition-all duration-200 ease-out active:cursor-grabbing"
            style={{
              opacity: dragIndex === i ? 0.92 : 1,
              transform: dragIndex === i ? "scale(1.06)" : "scale(1)",
              boxShadow: dragIndex === i ? "0 12px 28px rgba(0,0,0,0.4)" : undefined,
              touchAction: dragIndex === i ? "none" : "pan-x",
              zIndex: dragIndex === i ? 10 : undefined,
            }}
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
            className="flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/80 text-muted-foreground transition-all duration-200 ease-out hover:border-border hover:bg-muted/40 hover:text-foreground active:scale-95"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <Plus className="h-4.5 w-4.5" strokeWidth={2} />
            </span>
            <span className="text-[11.5px] font-medium">Adicionar</span>
          </button>
        )}
      </div>
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
    <div className="absolute right-1.5 top-1.5 flex gap-1.5">
      <button
        type="button"
        onClick={onEdit}
        aria-label="Editar imagem"
        className="rounded-full bg-black/50 p-1.5 text-white backdrop-blur-md transition-all duration-200 ease-out hover:bg-black/70 active:scale-90"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover imagem"
        className="rounded-full bg-black/50 p-1.5 text-white backdrop-blur-md transition-all duration-200 ease-out hover:bg-black/70 active:scale-90"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
