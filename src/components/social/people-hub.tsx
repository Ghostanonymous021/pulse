"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { PeopleList } from "@/components/profile/people-list";
import { PeopleSuggestions } from "@/components/social/people-suggestions";
import type { FollowListPerson } from "@/lib/social/follows";
import type { PeopleSuggestion } from "@/lib/social/suggestions";
import { cn } from "@/lib/utils";

type Tab = "sugestoes" | "seguidores" | "seguir";

/**
 * Pessoas hub: one screen, three views (Apple Settings-style segmented
 * control, not three separate pages). Local filter only — matches what
 * is already loaded, no network round-trip. Full account search across
 * everyone lives in Explorar; this is "find someone I'm already
 * connected to" (Contacts-app pattern), so the two never overlap.
 */
export function PeopleHub({
  suggestions,
  followers,
  following,
}: {
  suggestions: PeopleSuggestion[];
  followers: FollowListPerson[];
  following: FollowListPerson[];
}) {
  const [tab, setTab] = useState<Tab>("sugestoes");
  const [query, setQuery] = useState("");

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
      <div className="sticky top-12 z-10 space-y-3 border-b border-[var(--separator)] bg-[var(--elevated)] px-4 pb-3 pt-3 backdrop-blur-xl backdrop-saturate-150">
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
          <PeopleSuggestions suggestions={filteredSuggestions} />
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
