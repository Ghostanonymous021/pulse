import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Single top bar per screen. Never stack with a global app header.
 * Apple pattern: one navigation bar owns the top of each view.
 */
export function PageHeader({
  title,
  backHref,
  backLabel = "Voltar",
  left,
  right,
  border = true,
  className,
}: {
  title?: string;
  /** If set, shows leading back control */
  backHref?: string;
  backLabel?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  border?: boolean;
  className?: string;
}) {
  const showBack = Boolean(backHref);
  const sideWidth = showBack || left || right || title ? "w-16" : undefined;

  return (
    <header
      data-app-chrome
      className={cn(
        "gpu-anchor sticky top-0 z-20 flex h-12 shrink-0 items-center bg-[var(--elevated)] px-3 backdrop-blur-xl backdrop-saturate-150",
        border && "border-b border-[var(--separator)]",
        className,
      )}
    >
      <div className={cn("flex min-w-0 items-center", sideWidth ?? "flex-1")}>
        {showBack ? (
          <Link
            href={backHref!}
            className="inline-flex items-center gap-0.5 text-[15px] font-medium text-foreground/90 transition-opacity hover:opacity-70"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            <span className="sr-only sm:not-sr-only sm:inline">{backLabel}</span>
          </Link>
        ) : (
          left
        )}
      </div>

      {title ? (
        <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-semibold tracking-[-0.02em]">
          {title}
        </h1>
      ) : (
        <div className="flex-1" />
      )}

      <div
        className={cn(
          "flex min-w-0 items-center justify-end gap-0.5",
          sideWidth ?? "flex-1",
        )}
      >
        {right}
      </div>
    </header>
  );
}
