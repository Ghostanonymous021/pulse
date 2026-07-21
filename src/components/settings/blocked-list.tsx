"use client";

import Link from "next/link";
import { useState } from "react";

import { UserAvatar } from "@/components/profile/user-avatar";
import { createClient } from "@/lib/supabase/client";

export type BlockedPerson = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export function BlockedList({ people }: { people: BlockedPerson[] }) {
  const [items, setItems] = useState(people);

  if (items.length === 0) {
    return (
      <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
        Nenhuma conta bloqueada.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--separator)]">
      {items.map((p) => (
        <BlockedRow
          key={p.id}
          person={p}
          onUnblocked={() =>
            setItems((prev) => prev.filter((x) => x.id !== p.id))
          }
        />
      ))}
    </ul>
  );
}

function BlockedRow({
  person,
  onUnblocked,
}: {
  person: BlockedPerson;
  onUnblocked: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function unblock() {
    if (pending) return;
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", person.id);
      onUnblocked();
    } finally {
      setPending(false);
    }
  }

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
        onClick={unblock}
        className="shrink-0 rounded-full bg-muted px-3.5 py-2 text-[13px] font-medium tracking-[-0.01em] transition-all duration-200 ease-out active:scale-95 disabled:opacity-50"
      >
        Desbloquear
      </button>
    </li>
  );
}
