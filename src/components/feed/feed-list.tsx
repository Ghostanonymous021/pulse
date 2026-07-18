"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { PostCard, type PostWithAuthor } from "@/components/feed/post-card";
import { FEED_PAGE_SIZE } from "@/lib/posts/feed";

const SCROLL_KEY = "pulse:feed-scroll";

/**
 * Infinite feed + scroll restore when returning from /p/[id].
 * Initial page from RSC; more via /api/feed (no full document reload).
 */
export function FeedList({
  initialPosts,
  initialNextOffset,
}: {
  initialPosts: PostWithAuthor[];
  initialNextOffset: number | null;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);

  useEffect(() => {
    setPosts(initialPosts);
    setNextOffset(initialNextOffset);
  }, [initialPosts, initialNextOffset]);

  // Restore scroll after back-navigation from post detail
  useEffect(() => {
    try {
      const y = sessionStorage.getItem(SCROLL_KEY);
      if (y) {
        sessionStorage.removeItem(SCROLL_KEY);
        const top = Number(y);
        if (Number.isFinite(top) && top > 0) {
          requestAnimationFrame(() => {
            window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
          });
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadMore = useCallback(() => {
    if (nextOffset == null || loadingMore.current || pending) return;
    loadingMore.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/feed?offset=${nextOffset}&limit=${FEED_PAGE_SIZE}`,
        );
        const body = (await res.json()) as {
          posts?: PostWithAuthor[];
          nextOffset?: number | null;
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || "Falha ao carregar.");
        const more = body.posts ?? [];
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...more.filter((p) => !seen.has(p.id))];
        });
        setNextOffset(body.nextOffset ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar.");
      } finally {
        loadingMore.current = false;
      }
    });
  }, [nextOffset, pending]);

  // IntersectionObserver infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || nextOffset == null) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, nextOffset]);

  if (posts.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-[15px] font-medium tracking-[-0.02em]">
          O teu feed ainda esta quieto
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Segue colegas no Explorar ou publica a primeira coisa do dia.
        </p>
      </div>
    );
  }

  return (
    <>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div ref={sentinel} className="h-8" aria-hidden />
      {pending && (
        <p className="py-4 text-center text-[13px] text-muted-foreground">
          A carregar...
        </p>
      )}
      {error && (
        <button
          type="button"
          onClick={loadMore}
          className="mx-auto mb-6 block text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          Tentar de novo
        </button>
      )}
      {nextOffset == null && posts.length > FEED_PAGE_SIZE && (
        <p className="pb-8 text-center text-[12px] text-muted-foreground">
          Estás em dia
        </p>
      )}
    </>
  );
}

/** Call before navigating to post detail so home can restore position. */
export function rememberFeedScroll() {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  } catch {
    /* ignore */
  }
}
