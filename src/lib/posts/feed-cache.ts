import type { PostWithAuthor } from "@/components/feed/post-card";
import { FEED_HARD_TTL_MS, FEED_SOFT_TTL_MS } from "@/lib/posts/feed-constants";
export { FEED_HARD_TTL_MS, FEED_SOFT_TTL_MS, feedFreshness } from "@/lib/posts/feed-constants";
const MEMORY_KEY = "home";
const STORAGE_KEY_PREFIX = "pulse:feed-snapshot-v1";
const ALL_SCOPE_KEYS = ["home", "home:temporarias"] as const;
function storageKeyFor(key: string) {
  return key === MEMORY_KEY ? STORAGE_KEY_PREFIX : `${STORAGE_KEY_PREFIX}:${key}`;
}
export type FeedSnapshot = { posts: PostWithAuthor[]; nextOffset: number | null; savedAt: number };
const memory = new Map<string, FeedSnapshot>();
function canUseStorage() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}
export function readFeedSnapshot(key = MEMORY_KEY): FeedSnapshot | null {
  const mem = memory.get(key);
  if (mem) {
    if (Date.now() - mem.savedAt > FEED_HARD_TTL_MS) { memory.delete(key); return null; }
    return mem;
  }
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(storageKeyFor(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedSnapshot;
    if (!parsed?.posts || !Array.isArray(parsed.posts)) return null;
    if (Date.now() - parsed.savedAt > FEED_HARD_TTL_MS) {
      sessionStorage.removeItem(storageKeyFor(key));
      return null;
    }
    memory.set(key, parsed);
    return parsed;
  } catch { return null; }
}
export function writeFeedSnapshot(posts: PostWithAuthor[], nextOffset: number | null, key = MEMORY_KEY) {
  if (!posts.length) return;
  const snap: FeedSnapshot = { posts, nextOffset, savedAt: Date.now() };
  memory.set(key, snap);
  if (!canUseStorage()) return;
  try { sessionStorage.setItem(storageKeyFor(key), JSON.stringify(snap)); } catch { /* */ }
}
export function isFeedSoftFresh(snap: FeedSnapshot | null): boolean {
  if (!snap) return false;
  return Date.now() - snap.savedAt < FEED_SOFT_TTL_MS;
}
export function isFeedHardValid(snap: FeedSnapshot | null): boolean {
  if (!snap || !snap.posts.length) return false;
  return Date.now() - snap.savedAt <= FEED_HARD_TTL_MS;
}
export function invalidateFeedSnapshot(key = MEMORY_KEY) {
  memory.delete(key);
  if (!canUseStorage()) return;
  try { sessionStorage.removeItem(storageKeyFor(key)); } catch { /* */ }
}
export function invalidateAllFeedSnapshots() {
  for (const key of ALL_SCOPE_KEYS) invalidateFeedSnapshot(key);
}
