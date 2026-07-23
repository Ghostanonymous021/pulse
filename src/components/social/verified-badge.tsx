import { cn } from "@/lib/utils";
import type { AccountType } from "@/types/database";

/**
 * Verified badge — solid blue circle + white check.
 * Same visual language as the classic verified checkmark used across
 * major social platforms (X/Twitter, Facebook, current-gen Instagram):
 * flat blue disc, no gradient, no scalloped seal. Same shape for
 * "pessoa" and "organizacao" — accountType is kept in the API for the
 * accessible label and for a future distinct org treatment, but the
 * visual mark itself intentionally does not fork by account type.
 *
 * Single source of truth for the verified mark — every surface that
 * shows a name for a verified profile (feed, profile header, comments,
 * Explorar, people lists) must render this component so the badge
 * stays visually and behaviourally identical everywhere.
 */
export function VerifiedBadge({
  accountType,
  size = "md",
  className,
  title,
}: {
  accountType: AccountType;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}) {
  // Slightly larger than text line for visual parity with the platforms
  // this pattern is borrowed from.
  const px = size === "sm" ? 16 : size === "lg" ? 26 : 20;
  const isOrg = accountType === "organizacao";
  const label =
    title ?? (isOrg ? "Organizacao verificada" : "Conta verificada");
  const stroke = size === "sm" ? 2 : size === "lg" ? 2.35 : 2.2;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-flex shrink-0 align-middle", className)}
      style={{ width: px, height: px }}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        {/* Solid blue disc — same blue used platform-wide for verified
            marks (X / Facebook / current IG check), no gradient. */}
        <circle cx="12" cy="12" r="10.5" fill="#1D9BF0" />
        <path
          d="M7.2 12.05 10.35 15.1 16.9 8.4"
          stroke="#fff"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
