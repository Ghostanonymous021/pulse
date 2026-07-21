"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { rememberFeedScroll } from "@/components/feed/feed-list";
import type { PostMediaView } from "@/components/feed/post-card";
import { cn } from "@/lib/utils";

export function MediaFrame({
  media,
  postId,
  mode = "feed",
  onOpenLightbox,
}: {
  media: PostMediaView[];
  postId: string;
  mode?: "feed" | "detail";
  onOpenLightbox?: (index: number) => void;
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const total = media.length;

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el?.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(Math.min(total - 1, Math.max(0, i)));
  }, [total]);

  function go(delta: number) {
    const el = scroller.current;
    if (!el) return;
    const next = Math.min(total - 1, Math.max(0, index + delta));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setIndex(next);
  }

  function openPrimary() {
    if (mode === "feed") {
      rememberFeedScroll();
      router.push(`/p/${postId}`);
      return;
    }
    onOpenLightbox?.(index);
  }

  if (total === 0) return null;

  return (
    <div className="relative w-full">
      <div
        role="link"
        tabIndex={0}
        aria-label={
          mode === "feed" ? "Abrir publicação" : "Ver foto em ecrã cheio"
        }
        onClick={openPrimary}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPrimary();
          }
        }}
        className={cn(
          "relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-muted",
          "max-h-[70vh]",
          mode === "detail" && "cursor-zoom-in",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/25",
        )}
      >
        {total === 1 ? (
          <img
            src={media[0].url!}
            alt=""
            loading="lazy"
            decoding="async"
            className="block max-h-[70vh] max-w-full object-contain object-center"
            draggable={false}
          />
        ) : (
          <div
            ref={scroller}
            onScroll={onScroll}
            onClick={(e) => e.stopPropagation()}
            className="carousel-x flex w-full snap-x snap-mandatory overflow-x-auto"
          >
            {media.map((m) => (
              <img
                key={m.id}
                src={m.url!}
                alt=""
                loading="lazy"
                decoding="async"
                className="block h-[70vh] max-h-[70vh] w-full min-w-full shrink-0 snap-center object-cover object-center"
                draggable={false}
                onClick={(e) => {
                  e.stopPropagation();
                  openPrimary();
                }}
              />
            ))}
          </div>
        )}

        {total > 1 && (
          <>
            <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
              {index + 1}/{total}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1">
              {media.map((m, i) => (
                <span
                  key={m.id}
                  className={cn(
                    "h-1 w-1 rounded-full transition-opacity",
                    i === index
                      ? "bg-white opacity-100"
                      : "bg-white opacity-40",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => go(-1)}
            disabled={index === 0}
            className="absolute left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm disabled:opacity-0 md:flex"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <button
            type="button"
            aria-label="Seguinte"
            onClick={() => go(1)}
            disabled={index === total - 1}
            className="absolute right-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm disabled:opacity-0 md:flex"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </>
      )}
    </div>
  );
}
