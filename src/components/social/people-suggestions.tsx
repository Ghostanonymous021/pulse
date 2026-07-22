"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { FollowButton } from "@/components/social/follow-button";
import { UserAvatar } from "@/components/profile/user-avatar";
import { VerifiedBadge } from "@/components/social/verified-badge";
import {
  isVerificationActive,
  verificationBadgeType,
} from "@/lib/settings/verification";
import type { PeopleSuggestion } from "@/lib/social/suggestions";

/**
 * "Pessoas que talvez conheças" — list layout (same row pattern as
 * Seguidores/A seguir in people-list.tsx), not a 2-column card grid.
 * The grid version let long names/usernames overflow the fixed card
 * width because `items-center` on a flex column removes the width
 * constraint `truncate` needs; a full-width row with `min-w-0` avoids
 * that entirely and matches the rest of the "Pessoas" screen.
 */
export function PeopleSuggestions({
  suggestions,
}: {
  suggestions: PeopleSuggestion[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = suggestions.filter((s) => !dismissed.has(s.id));

  if (visible.length === 0) {
    return (
      <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
        Sem sugestões por agora. Volta mais tarde.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--separator)]">
      {visible.map((s) => {
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

            <div className="flex shrink-0 items-center gap-2">
              <FollowButton
                targetUserId={s.id}
                initialState={s.followState}
                className="h-9 w-[92px]"
              />
              <button
                type="button"
                aria-label="Dispensar sugestão"
                onClick={() =>
                  setDismissed((prev) => new Set(prev).add(s.id))
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
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
