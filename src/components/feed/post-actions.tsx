"use client";

import { useEffect, useState } from "react";
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
  const [pending, setPending] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (liked) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 420);
      return () => clearTimeout(t);
    }
  }, [liked]);

  async function toggleLike() {
    if (pending) return;
    const next = !liked;
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    setPending(true);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
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
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={toggleLike}
          disabled={pending}
          aria-label={liked ? "Remover gosto" : "Gostar"}
          aria-pressed={liked}
          className="relative rounded-full p-2 transition-colors hover:bg-muted/80 active:scale-95 disabled:opacity-50"
        >
          <Heart
            className={cn(
              "h-5 w-5 transition-all duration-200 ease-out",
              liked
                ? "fill-destructive text-destructive scale-110"
                : "text-foreground",
            )}
            strokeWidth={1.5}
          />
          {animating && liked && (
            <Heart
              aria-hidden
              className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 heart-pop text-destructive"
              strokeWidth={1.5}
            />
          )}
        </button>
        <Link
          href={`/p/${postId}`}
          aria-label="Comentarios"
          onClick={() => rememberFeedScroll()}
          className="rounded-full p-2 transition-all duration-200 ease-out hover:bg-muted/80 active:scale-95"
        >
          <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 px-2 text-[13px] font-medium tracking-[-0.01em]">
        {likeCount > 0 && (
          <span className={cn(liked && "like-count-hop")}>
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
