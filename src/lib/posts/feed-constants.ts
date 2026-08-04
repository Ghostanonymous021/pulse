/** Client-safe constants. ZERO imports beyond plain TS. */
export const FEED_PAGE_SIZE = 15;
export type FeedScope = "all" | "temporarias";
export const FEED_SOFT_TTL_MS = 90_000;
export const FEED_HARD_TTL_MS = 50 * 60_000;
export function feedFreshness(savedAt: number, now = Date.now()): "soft" | "hard" | "expired" {
  const age = now - savedAt;
  if (age < FEED_SOFT_TTL_MS) return "soft";
  if (age <= FEED_HARD_TTL_MS) return "hard";
  return "expired";
}
