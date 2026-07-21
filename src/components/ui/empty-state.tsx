import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Reusable empty state — icon + short copy + optional action.
 * Used for feed, profile posts/portfolio, messages, notifications,
 * followers/following, search results, reports history, etc.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft">
        <Icon className="h-5 w-5 text-brand-foreground" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-medium">{title}</p>
        {description && (
          <p className="text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className="mt-1 rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-brand-foreground transition-opacity hover:opacity-90"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
