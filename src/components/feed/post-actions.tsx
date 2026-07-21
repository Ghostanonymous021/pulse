"use client";

import { useState, useTransition } from "react";
import { Heart, MessageCircle } from "lucide-react";
import Link from "next/link";

import { rememberFeedScroll } from "@/components/feed/feed-list";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Like is fully optimistic — no router.refresh (native feel).
 * Server state is written in background; UI rolls back on error.
 */
export function PostActions({
  postId,
  initialLiked,
  initialLikeCount,
  commentCount,
}: {
  postId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  commentCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [pending, startTransition] = useTransition();

  function toggleLike() {
    if (pending) return;
    const next = !liked;
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));

    startTransition(async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLiked(prevLiked);
          setLikeCount(prevCount);
          return;
        }

        if (next) {
          const { error } = await supabase.from("likes").insert({
            user_id: user.id,
            post_id: postId,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("likes")
            .delete()
            .eq("user_id", user.id)
            .eq("post_id", postId);
          if (error) throw error;
        }
      } catch {
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    });
  }

  return (
    <div className="mt-3 space-y-1.5">
      {error && (
        <p className="shake text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={toggleLike}
          disabled={pending}
          aria-label={liked ? "Remover gosto" : "Gostar"}
          aria-pressed={liked}
          className="rounded-full p-2 transition-colors hover:bg-muted/80 active:scale-95 disabled:opacity-50"
        >
          <Heart
            className={cn(
              "h-[22px] w-[22px] transition-all duration-200 ease-out",
              liked ? "fill-brand text-brand scale-110" : "text-foreground",
            )}
            strokeWidth={1.5}
          />
        </button>
        <Link
          href={`/p/${postId}`}
          aria-label="Comentarios"
          onClick={() => rememberFeedScroll()}
          className="rounded-full p-2 transition-all duration-200 ease-out hover:bg-muted/80 active:scale-95"
        >
          <MessageCircle className="h-[22px] w-[22px]" strokeWidth={1.5} />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 px-2 text-[13px] font-medium tracking-[-0.01em]">
        {likeCount > 0 && (
          <span>
            {likeCount} {likeCount === 1 ? "gosto" : "gostos"}
          </span>
        )}
        {commentCount > 0 && (
          <Link
            href={`/p/${postId}`}
            onClick={() => rememberFeedScroll()}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {commentCount}{" "}
            {commentCount === 1 ? "comentario" : "comentarios"}
          </Link>
        )}
      </div>
    </div>
  );
}
