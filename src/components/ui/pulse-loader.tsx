"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
} as const;

/**
 * Brand "processing" indicator — replaces the generic Loader2 spinner
 * and any bare "A guardar..."-only text state.
 *
 * - CSS-only sonar pulse (scale 1 -> 1.8, opacity 1 -> 0), no animation lib.
 * - Debounced ~180ms: fast actions (optimistic follow, cached queries)
 *   never flash a loader at all — only truly pending work shows it.
 * - `tone="brand"` (default) paints the orange brand dot — use on any
 *   neutral/dark surface (bg-accent, bg-muted, bare text).
 * - `tone="on-brand"` drops the forced color and inherits `currentColor`
 *   from the parent instead — use on a brand-colored surface (bg-brand),
 *   where the button text is already `text-brand-foreground` (black, per
 *   the design tokens). This avoids orange-on-orange.
 * - `prefers-reduced-motion` is handled globally in globals.css.
 */
export function PulseLoader({
  size = "sm",
  tone = "brand",
  className,
  label = "A processar",
}: {
  size?: keyof typeof SIZES;
  tone?: "brand" | "on-brand";
  className?: string;
  label?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 180);
    return () => clearTimeout(t);
  }, []);

  if (!visible) {
    // Reserve the box so surrounding layout doesn't shift once it appears.
    return (
      <span className={cn(SIZES[size], className)} aria-hidden />
    );
  }

  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "pulse-loader",
        SIZES[size],
        tone === "brand" && "text-brand",
        className,
      )}
    >
      <span className="pulse-loader-core" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
