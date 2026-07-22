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
 * "Pessoas que talvez conheças" — Facebook People You May Know layout:
 * avatar + name/context left, dismiss (x) top-right of the card, follow
 * action bottom. Dismissing just removes from local view (no permanent
 * hide table yet — same scope as the rest of this feature pass).
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
    <div className="grid grid-cols-2 gap-3 p-3">
      {visible.map((s) => {
        const meta = contextLabel(s);
        const verified = isVerificationActive(s);
        return (
          <div
            key={s.id}
            className="relative flex flex-col rounded-2xl border border-[var(--separator)] bg-card p-3"
          >
            <button
              type="button"
              aria-label="Dispensar sugestão"
              onClick={() =>
                setDismissed((prev) => new Set(prev).add(s.id))
              }
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>

            <Link
              href={`/u/${s.username}`}
              className="flex flex-col items-center gap-2 pt-1 text-center"
            >
              <UserAvatar
                userId={s.id}
                avatarUrl={s.avatar_url}
                name={s.display_name || s.username}
                size={64}
              />
              <div className="min-w-0">
                <p className="flex min-w-0 items-center justify-center gap-1 truncate text-[14px] font-semibold tracking-[-0.02em]">
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
                <p className="truncate text-[12px] text-muted-foreground">
                  @{s.username}
                </p>
                {meta && (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {meta}
                  </p>
                )}
              </div>
            </Link>

            <FollowButton
              targetUserId={s.id}
              initialState={s.followState}
              className="mt-3 h-9 w-full"
            />
          </div>
        );
      })}
    </div>
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
