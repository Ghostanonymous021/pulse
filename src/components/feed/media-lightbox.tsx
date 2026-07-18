"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";

import type { PostMediaView } from "@/components/feed/post-card";
import { downloadFromUrl } from "@/lib/chat/download";
import { cn } from "@/lib/utils";

/**
 * Full-screen photo viewer — contain (no crop), stable controls.
 * Opened when tapping media on post detail.
 */
export function MediaLightbox({
  media,
  startIndex = 0,
  open,
  onClose,
}: {
  media: PostMediaView[];
  startIndex?: number;
  open: boolean;
  onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setIndex(startIndex);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Align scroll after paint
    requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) el.scrollLeft = startIndex * el.clientWidth;
    });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, startIndex]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, media.length]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el?.clientWidth) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  function go(delta: number) {
    const el = scroller.current;
    if (!el) return;
    const next = Math.min(media.length - 1, Math.max(0, index + delta));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setIndex(next);
  }

  if (!mounted || !open || media.length === 0) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fotos"
      className="fixed inset-0 z-[100] flex flex-col bg-black"
    >
      <div className="flex h-12 shrink-0 items-center justify-between px-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-full p-2 text-white/90 hover:bg-white/10"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
        {media.length > 1 ? (
          <span className="text-[13px] font-medium tabular-nums text-white/80">
            {index + 1} / {media.length}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          aria-label="Guardar foto"
          className="rounded-full p-2 text-white/90 hover:bg-white/10"
          onClick={() => {
            const m = media[index];
            if (!m?.url) return;
            void downloadFromUrl(m.url, `foto-${index + 1}.jpg`);
          }}
        >
          <Download className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="carousel-x flex h-full snap-x snap-mandatory overflow-x-auto"
        >
          {media.map((m) => (
            <div
              key={m.id}
              className="flex h-full w-full min-w-full shrink-0 snap-center items-center justify-center px-2"
              onClick={onClose}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.url!}
                alt=""
                className="max-h-full max-w-full object-contain"
                draggable={false}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ))}
        </div>

        {media.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Anterior"
              disabled={index === 0}
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-0"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Seguinte"
              disabled={index === media.length - 1}
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-0"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>

      {media.length > 1 && (
        <div className="flex h-10 shrink-0 items-center justify-center gap-1.5">
          {media.map((m, i) => (
            <span
              key={m.id}
              className={cn(
                "h-1 w-1 rounded-full",
                i === index ? "bg-white" : "bg-white/35",
              )}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
