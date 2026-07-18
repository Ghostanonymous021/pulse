"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type FollowUiState = "none" | "pending" | "accepted" | "self";

/**
 * Instagram follow states: Seguir | Solicitado | A seguir.
 * See docs/UX_PATTERNS.md §3.
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
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (state === "self") return null;

  async function run() {
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Inicia sessao.");
      return;
    }

    if (state === "none") {
      const { error: e } = await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: targetUserId,
      });
      if (e) {
        setError(e.message);
        return;
      }
      // Trigger sets pending vs accepted; re-read status
      const { data } = await supabase
        .from("follows")
        .select("status")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();
      setState(data?.status === "pending" ? "pending" : "accepted");
    } else {
      const { error: e } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);
      if (e) {
        setError(e.message);
        return;
      }
      setState("none");
    }

    router.refresh();
  }

  const label =
    state === "none" ? "Seguir" : state === "pending" ? "Solicitado" : "A seguir";

  const filled = state === "none";

  return (
    <div className={cn("flex flex-col items-stretch gap-1", className)}>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(run)}
        className={cn(
          "h-9 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50",
          filled
            ? "bg-accent text-accent-foreground hover:opacity-90"
            : "border border-border hover:bg-muted",
        )}
      >
        {pending ? "..." : label}
      </button>
      {error && (
        <p className="text-center text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
