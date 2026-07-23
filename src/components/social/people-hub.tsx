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

/**
 * Pessoas hub: one screen, three views (Apple Settings-style segmented
 * control, not three separate pages). Local filter only — matches what
 * is already loaded, no network round-trip. Full account search across
 * everyone lives in Explorar; this is "find someone I'm already
 * connected to" (Contacts-app pattern), so the two never overlap.
 *
 * Sugestões pagination: the full candidate pool (everyone not already
 * followed/following/blocked) is ranked server-side and paged in via
 * /api/people/suggestions — infinite scroll by default, "Ver mais" as
 * fallback (see people-suggestions.tsx). While a search query is active
 * we only filter what's already loaded and hide pagination controls,
 * same "local filter only" rule as Seguidores/A seguir below.
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

  const filteredSuggestions = useMemo(
    () => filterPeople(suggestions, q),
    [suggestions, q],
  );
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
        (filteredSuggestions.length === 0 && q ? (
          <SearchEmpty query={query} />
        ) : (
          <PeopleSuggestions
            suggestions={filteredSuggestions}
            hasMore={suggestionsNextOffset != null}
            loading={suggestionsLoading}
            error={suggestionsError}
            onLoadMore={loadMoreSuggestions}
            paginationDisabled={Boolean(q)}
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
