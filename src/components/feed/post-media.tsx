"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { MediaFrame } from "@/components/feed/media-frame";
import type { PostMediaView } from "@/components/feed/post-card";
import { cn } from "@/lib/utils";

const TEXT_CLAMP = 220;

export function PostMedia({
  media,
  postId,
  body,
  mode = "feed",
  onOpenLightbox,
}: {
  media: PostMediaView[];
  postId: string;
  body?: string | null;
  mode?: "feed" | "detail";
  onOpenLightbox?: (index: number) => void;
}) {
  const hasMedia = (media ?? []).some((m) => m.url);
  const bodyText = body?.trim();
  const isLong = (bodyText?.length ?? 0) > TEXT_CLAMP;
  const [showFull, setShowFull] = useState(false);

  const visibleBody =
    bodyText && (!isLong || showFull)
      ? bodyText
      : bodyText?.slice(0, TEXT_CLAMP) ?? "";

  return (
    <>
      {hasMedia && (
        <div className="relative w-full">
          <MediaFrame
            media={media.filter((m) => m.url)}
            postId={postId}
            mode={mode}
            onOpenLightbox={onOpenLightbox}
          />
        </div>
      )}

      {bodyText && (
        <div className="px-4 py-3">
          <div
            className={cn(
              "whitespace-pre-wrap text-[15px] leading-relaxed tracking-[-0.01em]",
              !hasMedia && "text-[16px]",
            )}
          >
            {visibleBody}
            {!showFull && isLong && "..."}
          </div>
          {isLong && !showFull && (
            <button
              type="button"
              onClick={() => setShowFull(true)}
              className="mt-2 flex items-center gap-1 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Mais
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
