"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search } from "lucide-react";

import { PeopleList } from "@/components/profile/people-list";
import { PeopleSuggestions } from "@/components/social/people-suggestions";
import type { FollowListPerson } from "@/lib/social/follows";
import {
  consumePeopleScroll,
  readPeopleSnapshot,
  rememberPeopleScroll,
  writePeopleSnapshot,
  type PeopleTab,
} from "@/lib/social/people-cache";
import type { PeopleSuggestion } from "@/lib/social/suggestions";
import { cn } from "@/lib/utils";

type Tab = PeopleTab;

// Debounce delay for server-side search-as-you-type. Long enough to not
// fire a request per keystroke, short enough to still feel instant.
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Pessoas hub: one screen, three views (Apple Settings-style segmented
 * control, not three separate pages).
 *
 * Search behaviour differs per tab, on purpose:
 * - Seguidores / A seguir: local filter only — these lists are already
 *   the viewer's *complete* follower/following graph fetched server-side,
 *   so there is nothing more to fetch and filtering in memory is both
 *   correct and instant.
 * - Sugestões: queries /api/people/search server-side (debounced), which
 *   runs the same search_profiles RPC Explorar uses across the *entire*
 *   network, not just whatever pages of pagination happen to be loaded
 *   client-side. Fixes a real bug: a newly-created account could rank
 *   deep in the suggestions pool (page 3+) and searching for it before
 *   scrolling that far used to say "no results" even though the account
 *   existed and was fully reachable by scrolling further — filtering
 *   only what was already in React state can never find what isn't
 *   loaded yet. Full account search across everyone (not scoped to PYMK
 *   exclusions) still lives in Explorar; the two intentionally don't
 *   overlap in purpose, only in the underlying RPC they both call.
 *
 * Sugestões pagination: the full candidate pool (everyone not already
 * followed/following/blocked) is ranked server-side and paged in via
 * /api/people/suggestions — infinite scroll by default, "Ver mais" as
 * fallback (see people-suggestions.tsx). Pagination is hidden while a
 * search query is active (results come from /api/people/search instead).
 *
 * Session persistence: tab, search query, loaded suggestion pages and
 * scroll position are mirrored into sessionStorage (lib/social/
 * people-cache.ts) — same pattern as the home feed. Without it, tapping
 * a person then "voltar" re-ran this whole screen from scratch: back to
 * page 0 of Sugestões, tab/search reset, and the scroll position landed
 * somewhere wrong because the list was shorter again. Restoring on
 * mount makes "back" instant instead of "reprocessing from the top".
 */
export function PeopleHub({
  initialSuggestions,
  initialSuggestionsNextOffset,
  followers,
  following,
}: {
  initialSuggestions: PeopleSuggestion[];
  initialSuggestionsNextOffset: number | null;
  followers: FollowListPerson[];
  following: FollowListPerson[];
}) {
  const boot = (() => {
    const snap = readPeopleSnapshot();
    if (snap && snap.suggestions.length > 0) return snap;
    return null;
  })();

  const [tab, setTab] = useState<Tab>(boot?.tab ?? "sugestoes");
  const [query, setQuery] = useState(boot?.query ?? "");

  const [suggestions, setSuggestions] = useState(
    boot?.suggestions ?? initialSuggestions,
  );
  const [suggestionsNextOffset, setSuggestionsNextOffset] = useState(
    boot?.suggestions?.length
      ? boot.suggestionsNextOffset
      : initialSuggestionsNextOffset,
  );
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(
    null,
  );
  const loadingSuggestionsRef = useRef(false);

  // Server-side search results for the Sugestões tab (see class doc
  // above for why this is a network round-trip and not a local filter).
  const [searchResults, setSearchResults] = useState<PeopleSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchRequestSeqRef = useRef(0);
  const [searchRetryTick, setSearchRetryTick] = useState(0);

  // Restore scroll position after a back-navigation (once, on mount).
  useEffect(() => {
    const y = consumePeopleScroll();
    if (y == null) return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    });
    // Mount-once — consumePeopleScroll() is one-shot by design.
  }, []);

  // Save scroll position right before an outbound navigation (tapping a
  // person's row) so we can restore it — mirrors feed-list.tsx.
  useEffect(() => {
    function onClickCapture(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      rememberPeopleScroll();
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  // Persist current tab/search/loaded-pages after every change so a
  // later "back" restores this exact state instead of the server's
  // initial page-0 snapshot.
  useEffect(() => {
    writePeopleSnapshot({
      tab,
      query,
      suggestions,
      suggestionsNextOffset,
    });
  }, [tab, query, suggestions, suggestionsNextOffset]);

  const loadMoreSuggestions = useCallback(() => {
    if (suggestionsNextOffset == null || loadingSuggestionsRef.current) {
      return;
    }
    loadingSuggestionsRef.current = true;
    setSuggestionsLoading(true);
    setSuggestionsError(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/people/suggestions?offset=${suggestionsNextOffset}&limit=20`,
        );
        if (!res.ok) throw new Error("Falha ao carregar mais pessoas.");
        const body = (await res.json()) as {
          suggestions?: PeopleSuggestion[];
          nextOffset?: number | null;
        };
        const more = body.suggestions ?? [];
        setSuggestions((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...more.filter((p) => !seen.has(p.id))];
        });
        setSuggestionsNextOffset(body.nextOffset ?? null);
      } catch (e) {
        setSuggestionsError(
          e instanceof Error ? e.message : "Falha ao carregar mais pessoas.",
        );
      } finally {
        loadingSuggestionsRef.current = false;
        setSuggestionsLoading(false);
      }
    })();
  }, [suggestionsNextOffset]);

  const q = query.trim().toLowerCase();
  const trimmedQuery = query.trim();

  // Sugestões: while a search is active, results come from the server
  // (full-network search, see searchResults effect below) instead of
  // filtering whatever pages happen to be loaded. Without a query, show
  // the normal ranked/paginated suggestions.
  //
  // The "nothing to search" case (empty query, or a different tab) is
  // handled as a plain derived bail-out — no setState call — so this
  // effect only ever touches state when it is actually about to fetch,
  // per the react-hooks/set-state-in-effect guidance (avoid synchronous
  // setState in an effect body outside of the async work it guards).
  const searchActive = tab === "sugestoes" && Boolean(trimmedQuery);
  useEffect(() => {
    if (!searchActive) return;

    const mySeq = ++searchRequestSeqRef.current;
    const timer = setTimeout(() => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSearchLoading(true);
      setSearchError(null);

      fetch(`/api/people/search?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("Falha ao pesquisar pessoas.");
          return res.json() as Promise<{ results?: PeopleSuggestion[] }>;
        })
        .then((body) => {
          if (searchRequestSeqRef.current !== mySeq) return;
          setSearchResults(body.results ?? []);
        })
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          if (searchRequestSeqRef.current !== mySeq) return;
          setSearchError(
            e instanceof Error ? e.message : "Falha ao pesquisar pessoas.",
          );
        })
        .finally(() => {
          if (searchRequestSeqRef.current !== mySeq) return;
          setSearchLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    // Cleanup runs on every dep change (new keystroke, tab switch, retry)
    // and on unmount — cancels a pending debounce timer and/or an
    // in-flight fetch for a query that is no longer current. Stale
    // searchResults/searchLoading/searchError left behind when
    // searchActive turns false are harmless: the UI branch that reads
    // them is only rendered while searchActive is true, and the mySeq
    // guard above already prevents a late response from a previous
    // query overwriting a newer one.
    return () => {
      clearTimeout(timer);
      searchAbortRef.current?.abort();
    };
  }, [searchActive, trimmedQuery, searchRetryTick]);

  const filteredSuggestions = searchActive ? searchResults : suggestions;
  const filteredFollowers = useMemo(
    () => filterPeople(followers, q),
    [followers, q],
  );
  const filteredFollowing = useMemo(
    () => filterPeople(following, q),
    [following, q],
  );

  const tabs: { key: Tab; label: string; count: number | null }[] = [
    { key: "sugestoes", label: "Sugestões", count: null },
    { key: "seguidores", label: "Seguidores", count: followers.length },
    { key: "seguir", label: "A seguir", count: following.length },
  ];

  return (
    <div>
      <div className="gpu-anchor sticky top-12 z-10 space-y-3 border-b border-[var(--separator)] bg-[var(--elevated)] px-4 pb-3 pt-3 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex items-center gap-2 rounded-full bg-muted/70 px-3 py-2">
          <Search
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={1.5}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar por nome ou @username"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div
          role="tablist"
          aria-label="Ver"
          className="grid grid-cols-3 gap-1 rounded-full bg-muted/60 p-1"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex h-8 items-center justify-center gap-1 rounded-full text-[13px] font-medium tracking-[-0.01em] transition-all duration-200 ease-out",
                tab === t.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span className="tabular-nums text-muted-foreground">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "sugestoes" &&
        (searchActive ? (
          filteredSuggestions.length === 0 && !searchLoading ? (
            <SearchEmpty query={query} />
          ) : (
            <PeopleSuggestions
              suggestions={filteredSuggestions}
              hasMore={false}
              loading={searchLoading}
              error={searchError}
              onLoadMore={() => setSearchRetryTick((n) => n + 1)}
              paginationDisabled
            />
          )
        ) : (
          <PeopleSuggestions
            suggestions={filteredSuggestions}
            hasMore={suggestionsNextOffset != null}
            loading={suggestionsLoading}
            error={suggestionsError}
            onLoadMore={loadMoreSuggestions}
            paginationDisabled={false}
          />
        ))}

      {tab === "seguidores" &&
        (filteredFollowers.length === 0 && q ? (
          <SearchEmpty query={query} />
        ) : (
          <PeopleList people={filteredFollowers} />
        ))}

      {tab === "seguir" &&
        (filteredFollowing.length === 0 && q ? (
          <SearchEmpty query={query} />
        ) : (
          <PeopleList people={filteredFollowing} />
        ))}
    </div>
  );
}

function filterPeople<T extends { display_name: string; username: string }>(
  people: T[],
  q: string,
): T[] {
  if (!q) return people;
  return people.filter(
    (p) =>
      p.display_name.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q),
  );
}

function SearchEmpty({ query }: { query: string }) {
  return (
    <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
      Sem resultados para &ldquo;{query}&rdquo;.
    </p>
  );
}
