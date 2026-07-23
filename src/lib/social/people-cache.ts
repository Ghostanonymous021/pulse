import type { PeopleSuggestion } from "@/lib/social/suggestions";

/**
 * Client-side "Pessoas" snapshot (sessionStorage) — same pattern as
 * lib/posts/feed-cache.ts for the home feed.
 *
 * Why: without this, tapping a person → viewing their profile → going
 * back re-runs the Pessoas server component from scratch: Sugestões
 * resets to page 0 (losing every extra page the infinite scroll had
 * already loaded), the active tab/search resets to the default, and
 * the scroll position is lost — the list is shorter now, so the old
 * scrollY lands somewhere else entirely (reads as "jumped back up and
 * is reprocessing the bottom again"). Restoring the last-seen state on
 * mount makes "back" instant instead of "starting over", same as
 * Instagram/Twitter do for any list screen you can drill into.
 *
 * Followers/A seguir are not paginated (always fully loaded server-side
 * per page.tsx), so only Sugestões' loaded pages need caching here —
 * the other two tabs' data always comes fresh from the server prop.
 *
 * Security: only IDs + public-ish profile fields already shown to the
 * viewer; sessionStorage is origin-scoped and cleared on tab close.
 */

const STORAGE_KEY = "pulse:people-snapshot-v1";
const SCROLL_KEY = "pulse:pessoas-scroll";
/** Discard snapshot entirely past this age — follow state may be stale. */
const HARD_TTL_MS = 30 * 60_000;

export type PeopleTab = "sugestoes" | "seguidores" | "seguir";

export type PeopleSnapshot = {
  tab: PeopleTab;
  query: string;
  suggestions: PeopleSuggestion[];
  suggestionsNextOffset: number | null;
  savedAt: number;
};

function canUseStorage() {
  return (
    typeof window !== "undefined" && typeof sessionStorage !== "undefined"
  );
}

export function readPeopleSnapshot(): PeopleSnapshot | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PeopleSnapshot;
    if (!parsed?.savedAt || !Array.isArray(parsed.suggestions)) return null;
    if (Date.now() - parsed.savedAt > HARD_TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePeopleSnapshot(snapshot: Omit<PeopleSnapshot, "savedAt">) {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...snapshot, savedAt: Date.now() }),
    );
  } catch {
    /* quota / private mode — session just won't restore, not fatal */
  }
}

/** Call after actions that make the cached lists stale (e.g. block). */
export function invalidatePeopleSnapshot() {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Call before navigating away (e.g. tapping a person) so we can restore. */
export function rememberPeopleScroll() {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  } catch {
    /* ignore */
  }
}

/** One-shot read — consumed by the mount that restores it. */
export function consumePeopleScroll(): number | null {
  if (!canUseStorage()) return null;
  try {
    const y = sessionStorage.getItem(SCROLL_KEY);
    if (!y) return null;
    sessionStorage.removeItem(SCROLL_KEY);
    const top = Number(y);
    return Number.isFinite(top) && top > 0 ? top : null;
  } catch {
    return null;
  }
}
