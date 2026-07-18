"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Instagram follow-request row: avatar, name, Confirmar | Eliminar.
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function act(action: "accept" | "reject") {
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (action === "accept") {
        await supabase
          .from("follows")
          .update({ status: "accepted" })
          .eq("follower_id", followerId)
          .eq("following_id", user.id)
          .eq("status", "pending");
      } else {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", followerId)
          .eq("following_id", user.id)
          .eq("status", "pending");
      }
      router.refresh();
    });
  }

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
