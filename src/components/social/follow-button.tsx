"use client";

import { useState } from "react";

import { PulseLoader } from "@/components/ui/pulse-loader";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type FollowUiState = "none" | "pending" | "accepted" | "self";

/**
 * Fully optimistic follow — no router.refresh.
 * Why: refresh re-runs every RSC on the tree (feed ranking, signed
 * URLs, badges). Instagram never reloads the profile shell to flip
 * "Seguir" → "A seguir"; local state is the source of truth.
 */
export function FollowButton({
  targetUserId,
  initialState,
  className,
}: {
  targetUserId: string;
  initialState: FollowUiState;
  className?: string;
}) {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === "self") return null;

  async function run() {
    setError(null);
    setPending(true);
    const prev = state;
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setError("Inicia sessão.");
        return;
      }

      if (state === "none") {
        // Optimistic: assume public → accepted; private may flip to pending
        setState("accepted");
        const { error: e } = await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: targetUserId,
        });
        if (e) {
          setState(prev);
          setError(e.message);
          return;
        }
        const { data } = await supabase
          .from("follows")
          .select("status")
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId)
          .maybeSingle();
        setState(data?.status === "pending" ? "pending" : "accepted");
      } else {
        setState("none");
        const { error: e } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        if (e) {
          setState(prev);
          setError(e.message);
          return;
        }
      }
    } finally {
      setPending(false);
    }
  }

  const label =
    state === "none" ? "Seguir" : state === "pending" ? "Solicitado" : "A seguir";

  const filled = state === "none";

  return (
    <div className={cn("flex flex-col items-stretch gap-1", className)}>
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className={cn(
          "flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium transition-all duration-200 ease-out disabled:opacity-60",
          filled
            ? "bg-brand text-brand-foreground hover:opacity-90 active:scale-95"
            : "border border-border hover:bg-muted active:scale-95",
        )}
      >
        {pending ? (
          <PulseLoader size="sm" tone={filled ? "on-brand" : "brand"} />
        ) : (
          label
        )}
      </button>
      {error && (
        <p className="shake text-center text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
