/**
 * In-memory rate limit (single Node process).
 *
 * Production multi-instance: set RATE_LIMIT_BACKEND=redis and wire Upstash
 * (or edge WAF). Until then, pair with platform-level limits and per-user keys.
 *
 * Periodically prunes expired buckets to avoid unbounded Map growth.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastPrune = 0;
const PRUNE_EVERY_MS = 60_000;
const MAX_KEYS = 20_000;

function prune(now: number) {
  if (now - lastPrune < PRUNE_EVERY_MS && buckets.size < MAX_KEYS) return;
  lastPrune = now;
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
  // Emergency cap under flood
  if (buckets.size > MAX_KEYS) {
    buckets.clear();
  }
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  prune(now);
  const current = buckets.get(key);

  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { ok: true };
}
