import type { PostWithAuthor } from "@/components/feed/post-card";

/**
 * Client-side feed snapshot (module memory + sessionStorage).
 *
 * Why: App Router re-runs the Home RSC when the soft-nav cache expires
 * or on hard refresh. Showing the last good feed instantly (SWR-style)
 * removes the blank/skeleton flash that makes the app feel "always
 * reloading" — same pattern Meta/Twitter use for the home timeline.
 *
 * Security: only IDs + public-ish post fields already shown to the
 * viewer; sessionStorage is origin-scoped and cleared on tab close.
 * Signed media URLs expire; we re-fetch if the snapshot is stale.
 */

const MEMORY_KEY = "home";
const STORAGE_KEY = "pulse:feed-snapshot-v1";
/** Soft-fresh: paint instantly, revalidate in background after this. */
export const FEED_SOFT_TTL_MS = 45_000;
/** Hard-stale: discard snapshot entirely (signed URLs may be dead). */
export const FEED_HARD_TTL_MS = 50 * 60_000;

export type FeedSnapshot = {
  posts: PostWithAuthor[];
  nextOffset: number | null;
  savedAt: number;
};

const memory = new Map<string, FeedSnapshot>();

function canUseStorage() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function readFeedSnapshot(key = MEMORY_KEY): FeedSnapshot | null {
  const mem = memory.get(key);
  if (mem) return mem;
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedSnapshot;
    if (!parsed?.posts || !Array.isArray(parsed.posts)) return null;
    if (Date.now() - parsed.savedAt > FEED_HARD_TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeFeedSnapshot(
  posts: PostWithAuthor[],
  nextOffset: number | null,
  key = MEMORY_KEY,
) {
  const snap: FeedSnapshot = {
    posts,
    nextOffset,
    savedAt: Date.now(),
  };
  memory.set(key, snap);
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* quota / private mode — memory still helps */
  }
}

export function isFeedSoftFresh(snap: FeedSnapshot | null): boolean {
  if (!snap) return false;
  return Date.now() - snap.savedAt < FEED_SOFT_TTL_MS;
}

/** Drop cache after publish / delete so next home load is authoritative. */
export function invalidateFeedSnapshot(key = MEMORY_KEY) {
  memory.delete(key);
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
