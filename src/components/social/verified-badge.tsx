import { cn } from "@/lib/utils";
import type { AccountType } from "@/types/database";

/**
 * Instagram-style verified seal:
 * scalloped rosette + white check, blue→violet gradient.
 * Sized to read clearly next to names in feed/profile.
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
  // Slightly larger than text line for visual parity with IG
  const px = size === "sm" ? 16 : size === "lg" ? 26 : 20;
  const isOrg = accountType === "organizacao";
  const label =
    title ?? (isOrg ? "Organizacao verificada" : "Conta verificada");
  const gid = `pulse-vbadge-${size}-${isOrg ? "o" : "p"}`;
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
        <defs>
          <linearGradient
            id={gid}
            x1="3"
            y1="2"
            x2="21"
            y2="22"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#4F8CFF" />
            <stop offset="0.55" stopColor="#7B6CFF" />
            <stop offset="1" stopColor="#B24BFF" />
          </linearGradient>
        </defs>
        <path
          fill={`url(#${gid})`}
          d="M12 1.6c.55 0 1.05.2 1.44.55l.9.82c.28.25.64.39 1.02.4l1.21.02c.9.02 1.66.62 1.9 1.48l.32 1.16c.1.37.34.69.67.9l1.05.66c.78.49 1.1 1.46.77 2.3l-.44 1.12c-.13.35-.13.73 0 1.08l.44 1.12c.33.84.01 1.81-.77 2.3l-1.05.66c-.33.21-.57.53-.67.9l-.32 1.16c-.24.86-1 1.46-1.9 1.48l-1.21.02c-.38.01-.74.15-1.02.4l-.9.82c-.39.35-.89.55-1.44.55s-1.05-.2-1.44-.55l-.9-.82a1.6 1.6 0 0 0-1.02-.4l-1.21-.02c-.9-.02-1.66-.62-1.9-1.48l-.32-1.16a1.6 1.6 0 0 0-.67-.9l-1.05-.66c-.78-.49-1.1-1.46-.77-2.3l.44-1.12c.13-.35.13-.73 0-1.08l-.44-1.12c-.33-.84-.01-1.81.77-2.3l1.05-.66c.33-.21.57-.53.67-.9l.32-1.16c.24-.86 1-1.46 1.9-1.48l1.21-.02c.38-.01.74-.15 1.02-.4l.9-.82c.39-.35.89-.55 1.44-.55Z"
        />
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
