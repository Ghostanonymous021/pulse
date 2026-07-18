import Link from "next/link";

import { profileCompletion } from "@/lib/profile/completeness";
import type { Profile } from "@/types/database";

export function ProfileCompleteBanner({ profile }: { profile: Profile }) {
  const { complete, percent, gaps } = profileCompletion(profile);
  if (complete) return null;

  const hint = gaps
    .slice(0, 3)
    .map((g) => g.label)
    .join(", ");

  return (
    <Link
      href="/perfil/editar?from=definicoes"
      className="mx-4 mt-3 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--separator)] bg-muted/40 px-3.5 py-3 transition-colors hover:bg-muted/70"
    >
      <div className="relative h-9 w-9 shrink-0">
        <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-muted"
          />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${(percent / 100) * 94} 94`}
            strokeLinecap="round"
            className="text-foreground"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums">
          {percent}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium tracking-[-0.02em]">
          Termina de configurar o perfil
        </p>
        <p className="truncate text-[12px] text-muted-foreground">
          Falta {hint}
          {gaps.length > 3 ? "…" : ""}
        </p>
      </div>
    </Link>
  );
}
