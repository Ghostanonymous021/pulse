"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Rss } from "lucide-react";

import { PostCard, type PostWithAuthor } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FEED_SOFT_TTL_MS,
  invalidateFeedSnapshot,
  isFeedSoftFresh,
  readFeedSnapshot,
  writeFeedSnapshot,
} from "@/lib/posts/feed-cache";
import { FEED_PAGE_SIZE, type FeedScope } from "@/lib/posts/feed";

const SCROLL_KEY = "pulse:feed-scroll";
/** How often to ask "anything new?" — not a full re-rank. */
const CHECK_BASE_MS = 45_000;
const CHECK_BACKOFF = [90_000, 180_000, 300_000];
const NEAR_TOP_PX = 80;

export function FeedList({
  initialPosts,
  initialNextOffset,
  scope = "all",
}: {
  initialPosts: PostWithAuthor[];
  initialNextOffset: number | null;
  scope?: FeedScope;
}) {
  const cacheKey = scope === "temporarias" ? "home:temporarias" : "home";
  // Prefer a soft-fresh client snapshot over a cold RSC paint when the
  // user just left and came back (staleTimes + this = native tab feel).
  const boot = (() => {
    const snap = readFeedSnapshot(cacheKey);
    if (
      snap &&
      isFeedSoftFresh(snap) &&
      snap.posts.length > 0 &&
      // Only prefer snapshot if server sent empty or same-or-older head
      (initialPosts.length === 0 ||
        snap.posts[0]?.id === initialPosts[0]?.id ||
        snap.savedAt > Date.now() - FEED_SOFT_TTL_MS)
    ) {
      // If server has a newer first post, trust server
      if (
        initialPosts[0] &&
        snap.posts[0] &&
        initialPosts[0].id !== snap.posts[0].id &&
        initialPosts[0].created_at > snap.posts[0].created_at
      ) {
        return {
          posts: initialPosts,
          nextOffset: initialNextOffset,
        };
      }
      return {
        posts: snap.posts,
        nextOffset: snap.nextOffset,
      };
    }
    return {
      posts: initialPosts,
      nextOffset: initialNextOffset,
    };
  })();

  const [posts, setPosts] = useState(boot.posts);
  const [nextOffset, setNextOffset] = useState(boot.nextOffset);
  const [error, setError] = useState<string | null>(null);
  const [newPosts, setNewPosts] = useState<PostWithAuthor[]>([]);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const postsRef = useRef(posts);
  const newPostsRef = useRef(newPosts);
  const backoffIndex = useRef(0);
  /**
   * Chronological "latest" may rank below the fold. After we probe and
   * pull page-0 without finding that id, remember it so we never re-run
   * the expensive rank+sign path for the same head.
   */
  const acknowledgedHeads = useRef(new Set<string>());

  useEffect(() => {
    postsRef.current = posts;
    for (const p of posts) acknowledgedHeads.current.add(p.id);
    writeFeedSnapshot(posts, nextOffset, cacheKey);
    // cacheKey is stable per mount (scope switch remounts via key= upstream)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, nextOffset]);

  useEffect(() => {
    newPostsRef.current = newPosts;
  }, [newPosts]);

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

  // When server sent fresher data than our boot snapshot, adopt it once.
  useEffect(() => {
    if (!initialPosts.length) return;
    const head = postsRef.current[0];
    const serverHead = initialPosts[0];
    if (!serverHead) return;
    if (
      !head ||
      (serverHead.id !== head.id &&
        serverHead.created_at >= head.created_at)
    ) {
      setPosts(initialPosts);
      setNextOffset(initialNextOffset);
    }
    // Only on mount / server prop identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPosts, initialNextOffset]);

  const loadMore = useCallback(() => {
    if (nextOffset == null || loadingMore.current) return;
    loadingMore.current = true;
    setError(null);

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 20_000);

    (async () => {
      try {
        const res = await fetch(
          `/api/feed?offset=${nextOffset}&limit=${FEED_PAGE_SIZE}&scope=${scope}`,
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

  /**
   * Smart "new content" loop — big-app pattern:
   * 1. Cheap HEAD check (`/api/feed/check`) — one row, no ranking
   * 2. Full fetch only if latestId is unknown
   * 3. Backoff when user scrolled down / tab hidden
   * 4. Stable deps (refs) so we don't reset the timer on every like
   */
  useEffect(() => {
    if (postsRef.current.length === 0 && initialPosts.length === 0) return;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const scheduleMs = () => {
      if (document.hidden) return CHECK_BACKOFF[2];
      const scrollY = window.scrollY;
      if (scrollY > 400) return CHECK_BACKOFF[2];
      if (scrollY > 200) return CHECK_BACKOFF[1];
      const step = Math.min(backoffIndex.current, CHECK_BACKOFF.length - 1);
      return step === 0 ? CHECK_BASE_MS : CHECK_BACKOFF[step - 1] ?? CHECK_BASE_MS;
    };

    const pullFresh = async (
      signal: AbortSignal,
      probedId: string | null,
    ) => {
      const res = await fetch(
        `/api/feed?offset=0&limit=${FEED_PAGE_SIZE}&scope=${scope}`,
        { signal },
      );
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as { posts?: PostWithAuthor[] };
      const latest = body.posts ?? [];

      const known = new Set([
        ...postsRef.current.map((p) => p.id),
        ...newPostsRef.current.map((p) => p.id),
      ]);
      const fresh = latest.filter((p) => !known.has(p.id));

      // Always ack the chronological head we probed — ranking may bury it
      // below page 0; without this we full-fetch forever for the same id.
      if (probedId) acknowledgedHeads.current.add(probedId);
      for (const p of latest) acknowledgedHeads.current.add(p.id);

      if (fresh.length === 0) {
        backoffIndex.current = Math.min(
          backoffIndex.current + 1,
          CHECK_BACKOFF.length,
        );
        return;
      }

      backoffIndex.current = 0;

      if (window.scrollY < NEAR_TOP_PX) {
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...fresh.filter((p) => !seen.has(p.id)), ...prev];
        });
      } else {
        setNewPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...fresh.filter((p) => !seen.has(p.id))];
        });
      }
    };

    const tick = async () => {
      if (cancelled) return;
      if (document.hidden) {
        timeout = setTimeout(tick, 5_000);
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const checkRes = await fetch(`/api/feed/check?scope=${scope}`, {
          signal: controller.signal,
        });
        if (!checkRes.ok || cancelled) {
          timeout = setTimeout(tick, scheduleMs());
          return;
        }
        const check = (await checkRes.json()) as {
          latestId?: string | null;
        };
        const latestId = check.latestId ?? null;

        const alreadyHave =
          !latestId ||
          acknowledgedHeads.current.has(latestId) ||
          postsRef.current.some((p) => p.id === latestId) ||
          newPostsRef.current.some((p) => p.id === latestId);

        if (alreadyHave) {
          backoffIndex.current = Math.min(
            backoffIndex.current + 1,
            CHECK_BACKOFF.length,
          );
          timeout = setTimeout(tick, scheduleMs());
          return;
        }

        await pullFresh(controller.signal, latestId);
      } catch {
        /* next tick retries */
      } finally {
        if (!cancelled) {
          timeout = setTimeout(tick, scheduleMs());
        }
      }
    };

    timeout = setTimeout(tick, CHECK_BASE_MS);

    function onVis() {
      if (!document.hidden) {
        // Tab focused again — check soon, not immediately thrash
        clearTimeout(timeout);
        timeout = setTimeout(tick, 1_500);
      }
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      abortRef.current?.abort();
      document.removeEventListener("visibilitychange", onVis);
    };
    // Mount-once loop; state via refs so likes don't restart polling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        icon={Rss}
        title="O teu feed ainda está quieto"
        description="Segue pessoas em Explorar ou se calhar es tu quem partilha a primeira coisa hoje."
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
            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-brand-foreground shadow-lg transition-transform active:scale-95"
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

/** After publish/delete — next home paint should not trust stale snapshot. */
export function bustFeedCache() {
  invalidateFeedSnapshot();
}
