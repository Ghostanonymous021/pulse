/**
 * Client-safe constants/types shared between server feed logic
 * (`@/lib/posts/feed`) and client components (`feed-list.tsx`,
 * `feed-scope-tabs.tsx`, `profile-tabs.tsx`).
 *
 * This file must have ZERO imports beyond plain TS. `feed.ts` pulls in
 * server-only code (Supabase queries, link-preview OG fetch, SSRF guard
 * using `node:dns/promises`) — any client component that imports a
 * *value* (not just a type) from `feed.ts` forces the whole module graph,
 * including `node:dns/promises`, into the browser bundle, which Turbopack
 * cannot chunk ("the chunking context does not support external modules")
 * and crashes the page with a 500 in dev (and would bloat/break the
 * production client bundle the same way).
 *
 * Keep `FEED_PAGE_SIZE` and `FeedScope` here, re-exported by `feed.ts` for
 * server call sites, so client code never has to reach into the
 * server-only module just for a page-size constant or a union type.
 */

/** First paint: short page. More via /api/feed. */
export const FEED_PAGE_SIZE = 15;

export type FeedScope = "all" | "temporarias";
