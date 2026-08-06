"use client";

import { useEffect, useRef, useState } from "react";
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
  const [animating, setAnimating] = useState(false);
  // Numera cada tentativa: se o utilizador tocar varias vezes seguidas
  // (rede lenta, indeciso), so a resposta da tentativa MAIS RECENTE pode
  // reverter o estado. Uma tentativa antiga que falhe tarde (ex.: colisao
  // na chave primaria user_id+post_id de um duplo-toque) nao deve desfazer
  // o que o utilizador decidiu depois.
  const attempt = useRef(0);

  useEffect(() => {
    if (liked) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 420);
      return () => clearTimeout(t);
    }
  }, [liked]);

  async function toggleLike() {
    const next = !liked;
    const prevLiked = liked;
    const prevCount = likeCount;
    // Feedback instantaneo sempre — nunca "engole" um toque. E assim que
    // X/Instagram fazem: o coracao responde ao toque, a rede que se
    // desenrasque em segundo plano.
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));

    const myAttempt = ++attempt.current;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        if (attempt.current === myAttempt) {
          setLiked(prevLiked);
          setLikeCount(prevCount);
        }
        return;
      }

      if (next) {
        // upsert + ignoreDuplicates: um segundo toque rapido que ja tinha
        // side efeito de um insert anterior em curso nao rebenta contra a
        // primary key (user_id, post_id) — so e ignorado, sem erro.
        const { error } = await supabase
          .from("likes")
          .upsert(
            { user_id: user.id, post_id: postId },
            { onConflict: "user_id,post_id", ignoreDuplicates: true },
          );
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
      // So reverte se esta ainda for a tentativa mais recente.
      if (attempt.current === myAttempt) {
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    }
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={toggleLike}
          aria-label={liked ? "Remover gosto" : "Gostar"}
          aria-pressed={liked}
          className="relative rounded-full p-2 transition-colors hover:bg-muted/80 active:scale-95"
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
