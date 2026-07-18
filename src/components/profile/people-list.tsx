import Link from "next/link";

import type { FollowListPerson } from "@/lib/social/follows";

export function PeopleList({ people }: { people: FollowListPerson[] }) {
  if (people.length === 0) {
    return (
      <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
        Ninguem aqui ainda.
      </p>
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
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[13px] font-semibold text-muted-foreground">
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (p.display_name || p.username).slice(0, 1).toUpperCase()
                )}
              </div>
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
