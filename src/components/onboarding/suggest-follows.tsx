"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { UserAvatar } from "@/components/profile/user-avatar";
import {
  FollowButton,
  type FollowUiState,
} from "@/components/social/follow-button";
import type { Profile } from "@/types/database";

type Suggestion = Pick<
  Profile,
  | "id"
  | "username"
  | "display_name"
  | "avatar_url"
  | "university"
  | "campus"
  | "course"
  | "account_type"
> & { followState: FollowUiState };

/**
 * Post-signup suggestions — IG “suggested accounts”, full-screen (no app chrome).
 * Ranking may use university context under the hood; copy stays short.
 */
export function SuggestFollows({ suggestions }: { suggestions: Suggestion[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function finish() {
    startTransition(() => {
      router.push("/home");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col">
      <div className="space-y-1.5 px-6 pb-5 pt-14">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">
          Sugestoes para seguir
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Para o teu feed comecar com pessoas relevantes. Podes saltar.
        </p>
      </div>

      <ul className="flex-1 divide-y divide-[var(--separator)] border-y border-[var(--separator)]">
        {suggestions.length === 0 && (
          <li className="px-6 py-12 text-center text-[14px] text-muted-foreground">
            Ainda ha poucas pessoas por aqui. Continua e explora para encontrar mais.
          </li>
        )}
        {suggestions.map((s) => {
          const meta = [s.university, s.campus, s.course]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3.5">
              <UserAvatar
                userId={s.id}
                avatarUrl={s.avatar_url}
                name={s.display_name || s.username}
                size={44}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">
                  {s.display_name || s.username}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  @{s.username}
                  {s.account_type === "organizacao" ? " · Organização" : ""}
                </p>
                {meta ? (
                  <p className="truncate text-[12px] text-muted-foreground">
                    {meta}
                  </p>
                ) : null}
              </div>
              <FollowButton
                targetUserId={s.id}
                initialState={s.followState}
                className="w-[7.25rem] shrink-0"
              />
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 space-y-3 bg-background/95 p-6 backdrop-blur-md">
        <button
          type="button"
          onClick={finish}
          disabled={pending}
           className="flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-accent text-[15px] font-semibold tracking-[-0.02em] text-accent-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95 disabled:opacity-50"
        >
          Continuar
        </button>
        <button
          type="button"
          onClick={finish}
          disabled={pending}
          className="flex h-10 w-full items-center justify-center text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Agora nao
        </button>
      </div>
    </div>
  );
}
