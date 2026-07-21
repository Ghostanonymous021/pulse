"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

import { PostCard, type PostWithAuthor } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { FEED_PAGE_SIZE } from "@/lib/posts/feed";

const SCROLL_KEY = "pulse:feed-scroll";
const BASE_POLL_MS = 25_000;
const BACKOFF_STEPS = [60_000, 120_000, 300_000];
const NEAR_TOP_PX = 80;

export function FeedList({
  initialPosts,
  initialNextOffset,
}: {
  initialPosts: PostWithAuthor[];
  initialNextOffset: number | null;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [error, setError] = useState<string | null>(null);
  const [newPosts, setNewPosts] = useState<PostWithAuthor[]>([]);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const seenIds = useRef<Set<string>>(new Set(initialPosts.map((p) => p.id)));
  const newPostsRef = useRef<Set<string>>(new Set());
  const backoffIndex = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  useEffect(() => {
    newPostsRef.current = new Set(newPosts.map((p) => p.id));
  }, [newPosts]);

  useEffect(() => {
    seenIds.current = new Set(posts.map((p) => p.id));
  }, [posts]);

  // Restore scroll after back-navigation
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

  // Save scroll on outbound clicks
  useEffect(() => {
    function onClickCapture(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      rememberFeedScroll();
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  const loadMore = useCallback(() => {
    if (nextOffset == null || loadingMore.current) return;
    loadingMore.current = true;
    setError(null);

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 20_000);

    (async () => {
      try {
        const res = await fetch(
          `/api/feed?offset=${nextOffset}&limit=${FEED_PAGE_SIZE}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("Falha ao carregar mais.");
        const body = (await res.json()) as {
          posts?: PostWithAuthor[];
          nextOffset?: number | null;
        };
        const more = body.posts ?? [];
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...more.filter((p) => !seen.has(p.id))];
        });
        setNextOffset(body.nextOffset ?? null);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Falha ao carregar.");
        }
      } finally {
        clearTimeout(id);
        loadingMore.current = false;
      }
    })();
  }, [nextOffset]);

  // Prefetch next page when sentinel is near
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

  // Smart polling: backoff + visibility + scroll-aware
  useEffect(() => {
    if (posts.length === 0) return;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const getBackoffMs = () => {
      const scrollY = window.scrollY;
      if (scrollY > 400) return BACKOFF_STEPS[2];
      if (scrollY > 200) return BACKOFF_STEPS[1];
      return BASE_POLL_MS;
    };

    const poll = async () => {
      if (cancelled) return;
      if (document.hidden) {
        timeout = setTimeout(poll, 2000);
        return;
      }

      // Cancel previous in-flight poll
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/feed?offset=0&limit=${FEED_PAGE_SIZE}`,
          { signal: controller.signal, next: { revalidate: 0 } },
        );
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { posts?: PostWithAuthor[] };
        const latest = body.posts ?? [];

        // Deduplicate against live posts + newPosts pill
        const known = new Set([
          ...posts.map((p) => p.id),
          ...newPosts.map((p) => p.id),
        ]);

        const fresh = latest.filter((p) => !known.has(p.id));
        if (fresh.length === 0) {
          backoffIndex.current = Math.max(0, backoffIndex.current - 1);
          timeout = setTimeout(poll, getBackoffMs());
          return;
        }

        backoffIndex.current = 0;

        if (window.scrollY < NEAR_TOP_PX) {
          // At top: inject directly
          setPosts((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...fresh.filter((p) => !seen.has(p.id)), ...prev];
          });
        } else {
          // Below top: accumulate in pill
          setNewPosts((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...fresh.filter((p) => !seen.has(p.id))];
          });
        }
      } catch {
        // silent — next poll retries
      } finally {
        if (!cancelled) {
          timeout = setTimeout(poll, getBackoffMs());
        }
      }
    };

    timeout = setTimeout(poll, getBackoffMs());
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      abortRef.current?.abort();
    };
  }, [posts.length, newPosts]);

  function showNewPosts() {
    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...newPosts.filter((p) => !seen.has(p.id)), ...prev];
    });
    setNewPosts([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="O teu feed ainda está quieto"
        description="Segue colegas no Explorar ou publica a primeira coisa do dia."
        action={{ label: "Explorar pessoas", href: "/explorar" }}
      />
    );
  }

  return (
    <>
      {newPosts.length > 0 && (
        <div className="sticky top-12 z-30 flex justify-center py-2">
          <button
            type="button"
            onClick={showNewPosts}
            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-black shadow-lg transition-transform active:scale-95"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            {newPosts.length === 1
              ? "1 nova publicação"
              : `${newPosts.length} novas publicações`}
          </button>
        </div>
      )}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div ref={sentinel} className="h-8" aria-hidden />
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
