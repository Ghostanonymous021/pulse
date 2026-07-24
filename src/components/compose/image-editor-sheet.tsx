"use client";

import { useRef, useState } from "react";
import { Check, FlipHorizontal, RotateCcw, RotateCw, X } from "lucide-react";
import { Cropper, type CropperRef } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";

/**
 * Editor de imagem full-screen: crop, girar, inverter.
 * Biblioteca consolidada (react-advanced-cropper) — sem editor proprio.
 * Ao concluir, devolve um File (JPEG) e volta automaticamente ao compose.
 */
export function ImageEditorSheet({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (edited: File) => void;
}) {
  const cropperRef = useRef<CropperRef>(null);
  const [src] = useState(() => URL.createObjectURL(file));
  const [busy, setBusy] = useState(false);

  function rotate(deg: number) {
    cropperRef.current?.rotateImage(deg);
  }

  function flip() {
    cropperRef.current?.flipImage(true, false);
  }

  async function confirm() {
    const canvas = cropperRef.current?.getCanvas();
    if (!canvas) {
      onCancel();
      return;
    }
    setBusy(true);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) {
          onCancel();
          return;
        }
        const edited = new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
          type: "image/jpeg",
        });
        URL.revokeObjectURL(src);
        onDone(edited);
      },
      "image/jpeg",
      0.92,
    );
  }

  function cancel() {
    URL.revokeObjectURL(src);
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div
        data-app-chrome
        className="flex items-center justify-between px-3 py-3 pt-[env(safe-area-inset-top)]"
      >
        <button
          type="button"
          aria-label="Cancelar"
          onClick={cancel}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <p className="text-[14.5px] font-medium text-white/90">Editar foto</p>
        <button
          type="button"
          aria-label="Concluir edicao"
          onClick={confirm}
          disabled={busy}
          className="flex h-9 w-9 items-center justify-center rounded-full text-brand hover:bg-white/10 disabled:opacity-50"
        >
          <Check className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <Cropper
          ref={cropperRef}
          src={src}
          className="h-full w-full"
          backgroundClassName="bg-black"
        />
      </div>

      <div className="flex items-center justify-center gap-8 px-6 py-5 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          aria-label="Girar para a esquerda"
          onClick={() => rotate(-90)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-transform hover:bg-white/10 active:scale-90"
        >
          <RotateCcw className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Inverter"
          onClick={flip}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-transform hover:bg-white/10 active:scale-90"
        >
          <FlipHorizontal className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Girar para a direita"
          onClick={() => rotate(90)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-transform hover:bg-white/10 active:scale-90"
        >
          <RotateCw className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
