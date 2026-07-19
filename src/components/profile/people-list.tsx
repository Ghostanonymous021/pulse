import Link from "next/link";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { FollowListPerson } from "@/lib/social/follows";

export function PeopleList({ people }: { people: FollowListPerson[] }) {
  if (people.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Ninguém aqui ainda"
        action={{ label: "Explorar pessoas", href: "/explorar" }}
      />
    );
  }

  return (
    <ul className="divide-y divide-[var(--separator)]">
      {people.map((p) => {
        const meta = [p.university, p.campus].filter(Boolean).join(" · ");
        return (
          <li key={p.id}>
            <Link
              href={`/u/${p.username}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <UserAvatar
                userId={p.id}
                avatarUrl={p.avatar_url}
                name={p.display_name || p.username}
                size={44}
              />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">
                  {p.display_name || p.username}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  @{p.username}
                </p>
                {meta && (
                  <p className="truncate text-[12px] text-muted-foreground">
                    {meta}
                  </p>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
