"use client";

import { useState, useTransition } from "react";
import { UserPlus, Clock } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type PostFollowState = "none" | "pending" | "accepted" | "self";

/**
 * Compact follow control for post headers — person-plus only when not following.
 * Private accounts → pending (clock) after tap; public → icon disappears.
 */
export function PostFollowIcon({
  authorId,
  initialState,
}: {
  authorId: string;
  initialState: PostFollowState;
}) {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();

  if (state === "self" || state === "accepted") return null;

  async function follow() {
    if (state !== "none") return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: authorId,
    });
    if (error) return;

    const { data } = await supabase
      .from("follows")
      .select("status")
      .eq("follower_id", user.id)
      .eq("following_id", authorId)
      .maybeSingle();

    setState(data?.status === "pending" ? "pending" : "accepted");
  }

  async function cancelPending() {
    if (state !== "pending") return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", authorId);
    if (error) return;
    setState("none");
  }

  if (state === "pending") {
    return (
      <button
        type="button"
        aria-label="Pedido enviado — tocar para cancelar"
        title="Solicitado"
        disabled={pending}
        onClick={() => startTransition(cancelPending)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 ease-out hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
      >
        <Clock className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Seguir"
      disabled={pending}
      onClick={() => startTransition(follow)}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground transition-all duration-200 ease-out",
        "hover:bg-muted active:scale-95 disabled:opacity-50",
      )}
    >
      <UserPlus className="h-[18px] w-[18px]" strokeWidth={1.5} />
    </button>
  );
}
