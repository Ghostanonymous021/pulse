"use client";

import { useState } from "react";
import { UserPlus, Clock } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type PostFollowState = "none" | "pending" | "accepted" | "self";

export function PostFollowIcon({
  authorId,
  initialState,
}: {
  authorId: string;
  initialState: PostFollowState;
}) {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);

  if (state === "self" || state === "accepted") return null;

  async function follow() {
    if (state !== "none") return;
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
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
    } finally {
      setPending(false);
    }
  }

  async function cancelPending() {
    if (state !== "pending") return;
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", authorId);
      if (error) return;
      setState("none");
    } finally {
      setPending(false);
    }
  }

  if (state === "pending") {
    return (
      <button
        type="button"
        aria-label="Pedido enviado — tocar para cancelar"
        title="Solicitado"
        disabled={pending}
        onClick={cancelPending}
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
      onClick={follow}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground transition-all duration-200 ease-out",
        "hover:bg-muted active:scale-95 disabled:opacity-50",
      )}
    >
      <UserPlus className="h-[18px] w-[18px]" strokeWidth={1.5} />
    </button>
  );
}
