"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type FollowUiState = "none" | "pending" | "accepted" | "self";

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === "self") return null;

  async function run() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Inicia sessão.");
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
        {pending ? <Spinner className="h-3.5 w-3.5" /> : label}
      </button>
      {error && (
        <p className="shake text-center text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
