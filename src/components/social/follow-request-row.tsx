"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

/**
 * Instagram follow-request row: avatar, name, Confirmar | Eliminar.
 * Hides itself optimistically — no router.refresh (would re-fetch
 * the whole notifications page + pending list).
 */
export function FollowRequestRow({
  followerId,
  username,
  displayName,
}: {
  followerId: string;
  username: string;
  displayName: string;
}) {
  const [gone, setGone] = useState(false);
  const [pending, startTransition] = useTransition();

  function act(action: "accept" | "reject") {
    setGone(true);
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setGone(false);
        return;
      }

      if (action === "accept") {
        const { error } = await supabase
          .from("follows")
          .update({ status: "accepted" })
          .eq("follower_id", followerId)
          .eq("following_id", user.id)
          .eq("status", "pending");
        if (error) setGone(false);
      } else {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", followerId)
          .eq("following_id", user.id)
          .eq("status", "pending");
        if (error) setGone(false);
      }
    });
  }

  if (gone) return null;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link
        href={`/u/${username}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
      >
        {(displayName || username).slice(0, 1).toUpperCase()}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/u/${username}`}
          className="block truncate text-sm font-semibold hover:underline"
        >
          {displayName || username}
        </Link>
        <p className="truncate text-xs text-muted-foreground">@{username}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => act("accept")}
          className="h-8 rounded-lg bg-accent px-3 text-xs font-medium text-accent-foreground disabled:opacity-50"
        >
          Confirmar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("reject")}
          className="h-8 rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
    </li>
  );
}
