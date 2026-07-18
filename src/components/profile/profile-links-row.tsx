import { Link2 } from "lucide-react";

import type { ProfileLink } from "@/lib/links/profile-links";

/** Label-only chips under bio — never show raw URL. */
export function ProfileLinksRow({ links }: { links: ProfileLink[] }) {
  if (!links.length) return null;

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {links.map((l) => (
        <li key={l.id}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--separator)] bg-card px-3 py-1.5 text-[13px] font-medium tracking-[-0.01em] transition-colors hover:bg-muted/50"
          >
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <span className="truncate">{l.rotulo}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
