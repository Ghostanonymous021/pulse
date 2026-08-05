"use client";

import { useRef, useState } from "react";
import { AlertCircle, Check, FlipHorizontal, RotateCcw, RotateCw, X } from "lucide-react";
import { Cropper, type CropperRef } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";
import type { CoreSettings, CropperState, Size } from "advanced-cropper/types";

import { PulseLoader } from "@/components/ui/pulse-loader";

/**
 * Tamanho inicial do crop = a foto inteira.
 *
 * A biblioteca por omissao usa 80% da area visivel, centrado — ou seja,
 * se o utilizador nao mexer em nada, a foto sai cortada nas bordas sem
 * ele perceber. Apps profissionais (Instagram, X) fazem o oposto: o
 * crop comeca a mostrar a foto INTEIRA, e o utilizador so perde partes
 * dela se deliberadamente apertar o enquadramento. "Nao mexer" deve
 * significar "publicar a foto completa".
 */
function fullImageSize(state: CropperState, settings: CoreSettings): Size {
  const area = state.visibleArea ?? state.imageSize;
  return { width: area.width, height: area.height };
}

/**
 * Editor de imagem full-screen: crop, girar, inverter.
 * Biblioteca consolidada (react-advanced-cropper) — sem editor proprio.
 * Ao concluir, devolve um File (JPEG) e volta automaticamente ao compose.
 *
 * Nota de robustez: o contentor do Cropper precisa de uma altura *concreta*
 * (nao so `flex-1`, sem `min-h-0`) — sem isso, o browser pode resolver a
 * altura do contentor como 0 num flex column (o cropper mede o pai, o pai
 * mede o conteudo, dependencia circular), o que produz exactamente um ecran
 * preto sem imagem visivel e `getCanvas()` a devolver null. Ver `min-h-0`
 * no wrapper abaixo — nao remover.
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
  const [error, setError] = useState<string | null>(null);

  function rotate(deg: number) {
    cropperRef.current?.rotateImage(deg);
  }

  function flip() {
    cropperRef.current?.flipImage(true, false);
  }

  async function confirm() {
    const canvas = cropperRef.current?.getCanvas();
    if (!canvas) {
      // Nunca descartar a foto em silencio: o utilizador fica sem saber
      // porque "nada aconteceu". Mostra o motivo e deixa a sheet aberta
      // para tentar de novo (ex.: apos o cropper acabar de carregar).
      setError("Ainda a preparar a imagem. Espera um instante e tenta outra vez.");
      return;
    }
    setBusy(true);
    setError(null);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) {
          setError("Não foi possível processar esta imagem. Tenta outra vez.");
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
      {/* Scrim: garante contraste dos icones sobre qualquer foto, clara ou escura —
          mesmo tratamento que apps de camera/galeria nativos usam. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      <div
        data-app-chrome
        className="relative z-20 flex items-center justify-between px-3 py-3 pt-[env(safe-area-inset-top)]"
      >
        <button
          type="button"
          aria-label="Cancelar"
          onClick={cancel}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-all duration-200 ease-out hover:bg-white/10 active:scale-95"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <p className="text-[14.5px] font-medium text-white/90">Editar foto</p>
        <button
          type="button"
          aria-label="Concluir edicao"
          onClick={confirm}
          disabled={busy}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-brand-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95 disabled:opacity-40"
        >
          {busy ? <PulseLoader size="sm" tone="on-brand" /> : <Check className="h-5 w-5" strokeWidth={2.5} />}
        </button>
      </div>

      {/* min-h-0 e obrigatorio aqui: sem ele, este filho flex-1 nao tem
          uma altura resolvida antes do Cropper medir o proprio pai —
          o resultado e ecran preto com getCanvas() a devolver null. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Cropper
          ref={cropperRef}
          src={src}
          defaultSize={fullImageSize}
          className="h-full w-full"
          backgroundClassName="bg-black"
        />
      </div>

      {error && (
        <div className="relative z-20 flex justify-center px-6 pb-3">
          <p
            className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-3.5 py-2 text-[12.5px] font-medium text-destructive backdrop-blur-sm"
            role="alert"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {error}
          </p>
        </div>
      )}

      {/* Scrim inferior — mesmo raciocinio do topo. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="relative z-20 flex items-center justify-center gap-8 px-6 py-5 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          aria-label="Girar para a esquerda"
          onClick={() => rotate(-90)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-all duration-200 ease-out hover:bg-white/10 active:scale-90"
        >
          <RotateCcw className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label="Inverter"
          onClick={flip}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-all duration-200 ease-out hover:bg-white/10 active:scale-90"
        >
          <FlipHorizontal className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label="Girar para a direita"
          onClick={() => rotate(90)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-all duration-200 ease-out hover:bg-white/10 active:scale-90"
        >
          <RotateCw className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
