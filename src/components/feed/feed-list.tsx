"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

import { PostCard, type PostWithAuthor } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { FEED_PAGE_SIZE } from "@/lib/posts/feed";

const SCROLL_KEY = "pulse:feed-scroll";
const NEW_POSTS_POLL_MS = 25_000;
const NEAR_TOP_PX = 80;

/**
 * Infinite feed + scroll restore when returning from /p/[id].
 * Initial page from RSC; more via /api/feed (no full document reload).
 * Polls for new posts at the top; if the user is scrolled down,
 * shows a "novas publicações" pill instead of shifting content
 * under them (Twitter/X pattern).
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
  const [newPosts, setNewPosts] = useState<PostWithAuthor[]>([]);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);
  const postsRef = useRef(posts);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

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

  // Save scroll position at the moment of click on any link leaving
  // this page -- covers footer tabs, header icons (Explorar, sino),
  // post links, anything. This runs BEFORE Next.js starts the route
  // transition. Doing this on unmount instead races with Next's own
  // scroll-to-top-on-navigate behavior, which can fire first and
  // leave scrollY already at 0 by the time cleanup runs.
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

  // Poll for new posts at the top of the feed.
  useEffect(() => {
    if (posts.length === 0) return;

    async function checkForNew() {
      try {
        const res = await fetch(`/api/feed?offset=0&limit=${FEED_PAGE_SIZE}`);
        if (!res.ok) return;
        const body = (await res.json()) as { posts?: PostWithAuthor[] };
        const latest = body.posts ?? [];
        const known = new Set(postsRef.current.map((p) => p.id));
        const fresh = latest.filter((p) => !known.has(p.id));
        if (fresh.length === 0) return;

        if (window.scrollY < NEAR_TOP_PX) {
          // Already at the top — safe to insert directly, nothing shifts under the reader.
          setPosts((prev) => [...fresh, ...prev]);
        } else {
          setNewPosts((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...fresh.filter((p) => !seen.has(p.id))];
          });
        }
      } catch {
        /* silent — next poll retries */
      }
    }

    const id = setInterval(checkForNew, NEW_POSTS_POLL_MS);
    return () => clearInterval(id);
  }, [posts.length]);

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
            className="flex items-center gap-1.5 rounded-full bg-[#FF9F0A] px-4 py-2 text-[13px] font-semibold text-black shadow-lg transition-transform active:scale-95"
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
      {pending && (
        <div className="flex justify-center py-4">
          <Spinner className="h-4 w-4 text-muted-foreground" />
        </div>
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
