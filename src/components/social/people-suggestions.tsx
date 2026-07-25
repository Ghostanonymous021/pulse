"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { FollowButton } from "@/components/social/follow-button";
import { UserAvatar } from "@/components/profile/user-avatar";
import { PulseLoader } from "@/components/ui/pulse-loader";
import { VerifiedBadge } from "@/components/social/verified-badge";
import {
  isVerificationActive,
  verificationBadgeType,
} from "@/lib/settings/verification";
import type { PeopleSuggestion } from "@/lib/social/suggestions";

/**
 * "Pessoas que talvez conheças" — list layout (same row pattern as
 * Seguidores/A seguir in people-list.tsx), not a 2-column card grid.
 *
 * Pagination is controlled by the parent (PeopleHub), which already
 * owns the search-filter state and needs the full loaded list to
 * filter against. This component is presentation + the scroll
 * sentinel only: infinite scroll (IntersectionObserver, same pattern
 * as the home feed in feed-list.tsx) with a manual "Ver mais" button
 * as fallback for when the observer doesn't fire (reduced motion,
 * some a11y tooling, unusual viewports). The full candidate pool
 * lives server-side in loadPeopleSuggestions — pagination controls
 * hide while a local search query is active, matching the existing
 * "local filter only" behaviour documented in PeopleHub.
 */
export function PeopleSuggestions({
  suggestions,
  hasMore,
  loading,
  error,
  onLoadMore,
  paginationDisabled = false,
}: {
  suggestions: PeopleSuggestion[];
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  onLoadMore: () => void;
  /** Hide pagination controls (e.g. while a local search filter is active). */
  paginationDisabled?: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);

  // Auto-load when the sentinel nears the viewport — recommended
  // default (no tap needed). "Ver mais" below stays as manual fallback.
  useEffect(() => {
    if (paginationDisabled) return;
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onLoadMore, hasMore, paginationDisabled]);

  if (suggestions.length === 0) {
    return (
      <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
        Ainda sem sugestões. Explora para encontrar pessoas novas.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-[var(--separator)]">
        {suggestions.map((s) => {
          const meta = contextLabel(s);
          const verified = isVerificationActive(s);
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Link
                href={`/u/${s.username}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <UserAvatar
                  userId={s.id}
                  avatarUrl={s.avatar_url}
                  name={s.display_name || s.username}
                  size={44}
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-[15px] font-semibold tracking-[-0.02em]">
                    <span className="truncate">
                      {s.display_name || s.username}
                    </span>
                    {verified && (
                      <VerifiedBadge
                        accountType={verificationBadgeType(s)}
                        size="sm"
                      />
                    )}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    @{s.username}
                  </p>
                  {meta && (
                    <p className="truncate text-[12px] text-muted-foreground">
                      {meta}
                    </p>
                  )}
                </div>
              </Link>

              <FollowButton
                targetUserId={s.id}
                initialState={s.followState}
                className="h-9 w-[92px] shrink-0"
              />
            </li>
          );
        })}
      </ul>

      {!paginationDisabled && <div ref={sentinel} className="h-8" aria-hidden />}

      {error && (
        <button
          type="button"
          onClick={onLoadMore}
          className="mx-auto mb-2 block text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          Tentar de novo
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center py-4">
          <PulseLoader size="sm" />
        </div>
      )}

      {!paginationDisabled && !loading && hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          className="mx-auto mb-6 block rounded-full bg-muted/70 px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          Ver mais pessoas
        </button>
      )}

      {!paginationDisabled && !hasMore && suggestions.length > 20 && (
        <p className="pb-8 text-center text-[12px] text-muted-foreground">
          Já viste todas as sugestões
        </p>
      )}
    </>
  );
}

function contextLabel(s: PeopleSuggestion): string {
  if (s.mutualCount > 0) {
    return s.mutualCount === 1
      ? "1 conexão em comum"
      : `${s.mutualCount} conexões em comum`;
  }
  if (s.sameCampus && s.campus) return s.campus;
  if (s.course) return s.course;
  if (s.university) return s.university;
  return "";
}
