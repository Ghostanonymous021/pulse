import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type SettingsRowProps = {
  icon: LucideIcon;
  label: string;
  /** Navigates to subtela; shows chevron */
  href?: string;
  /** Trailing value (muted), e.g. phone number or version */
  value?: string | null;
  /** Binary control instead of chevron */
  control?: React.ReactNode;
  /** Destructive label color (e.g. Apagar conta) */
  destructive?: boolean;
  /** Disabled row (no interaction) */
  disabled?: boolean;
  className?: string;
};

/**
 * Single settings item: icon + label + chevron | value | control.
 * Min tap target 44px.
 */
export function SettingsRow({
  icon: Icon,
  label,
  href,
  value,
  control,
  destructive,
  disabled,
  className,
}: SettingsRowProps) {
  const content = (
    <>
      <span
        data-app-chrome
        className={cn(
          "flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-muted",
          destructive && "bg-[#ff3b30]/10",
        )}
        aria-hidden
      >
        <Icon
          className={cn(
            "h-[17px] w-[17px]",
            destructive ? "text-[#ff3b30]" : "text-foreground/85",
          )}
          strokeWidth={1.5}
        />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left text-[16px] tracking-[-0.01em]",
          destructive ? "text-[#ff3b30]" : "text-foreground",
        )}
      >
        {label}
      </span>
      {control ? (
        <span className="ml-2 shrink-0">{control}</span>
      ) : (
        <>
          {value != null && value !== "" ? (
            <span className="ml-2 max-w-[45%] shrink-0 truncate text-right text-[15px] text-muted-foreground">
              {value}
            </span>
          ) : null}
          {href ? (
            <ChevronRight
              className="ml-1 h-[18px] w-[18px] shrink-0 text-muted-foreground/70"
              strokeWidth={1.5}
              aria-hidden
            />
          ) : null}
        </>
      )}
    </>
  );

  const rowClass = cn(
    // 44px+ tap target (Apple HIG)
    "flex min-h-[44px] w-full items-center gap-3 px-3.5 py-[11px] transition-colors",
    href && !disabled && "active:bg-muted/60 hover:bg-muted/40",
    disabled && "opacity-60",
    className,
  );

  return (
    <li>
      {href && !disabled ? (
        <Link href={href} className={rowClass}>
          {content}
        </Link>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  );
}
