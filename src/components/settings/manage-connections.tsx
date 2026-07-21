"use client";

import Link from "next/link";
import { useState } from "react";

import { UserAvatar } from "@/components/profile/user-avatar";
import type { FollowListPerson } from "@/lib/social/follows";
import { createClient } from "@/lib/supabase/client";

type Tab = "seguidores" | "a-seguir";

export function ManageConnections({
  followers,
  following,
  userId,
}: {
  followers: FollowListPerson[];
  following: FollowListPerson[];
  userId: string;
}) {
  const [tab, setTab] = useState<Tab>("seguidores");
  const list = tab === "seguidores" ? followers : following;

  return (
    <div>
      <div className="flex border-b border-[var(--separator)] px-4">
        <TabButton
          active={tab === "seguidores"}
          onClick={() => setTab("seguidores")}
          label="Seguidores"
          count={followers.length}
        />
        <TabButton
          active={tab === "a-seguir"}
          onClick={() => setTab("a-seguir")}
          label="A seguir"
          count={following.length}
        />
      </div>

      {list.length === 0 ? (
        <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
          Ninguem aqui ainda.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--separator)]">
          {list.map((p) => (
            <ConnectionRow
              key={p.id}
              person={p}
              mode={tab}
              ownerId={userId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-11 flex-1 text-[14px] font-medium tracking-[-0.01em] transition-all duration-200 ease-out ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {label}
      <span className="ml-1 text-muted-foreground">{count}</span>
      {active ? (
        <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-foreground" />
      ) : null}
    </button>
  );
}

function ConnectionRow({
  person,
  mode,
  ownerId,
}: {
  person: FollowListPerson;
  mode: Tab;
  ownerId: string;
}) {
  const [pending, setPending] = useState(false);
  const [gone, setGone] = useState(false);

  async function remove() {
    if (pending) return;
    setPending(true);
    try {
      const supabase = createClient();
      if (mode === "seguidores") {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", person.id)
          .eq("following_id", ownerId);
      } else {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", ownerId)
          .eq("following_id", person.id);
      }
      setGone(true);
    } finally {
      setPending(false);
    }
  }

  if (gone) return null;

  return (
    <li className="flex min-h-[64px] items-center gap-3 px-4 py-2.5">
      <Link
        href={`/u/${person.username}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <UserAvatar
          userId={person.id}
          avatarUrl={person.avatar_url}
          name={person.display_name || person.username}
          size={44}
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">
            {person.display_name || person.username}
          </p>
          <p className="truncate text-[13px] text-muted-foreground">
            @{person.username}
          </p>
        </div>
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        className="shrink-0 rounded-full bg-muted px-3.5 py-2 text-[13px] font-medium tracking-[-0.01em] text-foreground transition-all duration-200 ease-out active:scale-95 disabled:opacity-50"
      >
        {mode === "seguidores" ? "Remover" : "Deixar"}
      </button>
    </li>
  );
}
