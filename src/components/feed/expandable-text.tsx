"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Long body: 5-line clamp in feed with quiet "mais".
 * Detail pages pass expanded.
 */
export function ExpandableText({
  text,
  expanded = false,
  className,
}: {
  text: string;
  expanded?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(expanded);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    if (expanded || open) {
      setClamped(false);
      return;
    }
    const el = ref.current;
    if (!el) return;
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded, open]);

  if (expanded || open) {
    return (
      <p
        data-user-content
        className={cn(
          "whitespace-pre-wrap text-[15px] leading-[1.5] tracking-[-0.01em] text-foreground",
          className,
        )}
      >
        {text}
      </p>
    );
  }

  return (
    <div className={className}>
      <p
        ref={ref}
        data-user-content
        className="line-clamp-feed whitespace-pre-wrap text-[15px] leading-[1.5] tracking-[-0.01em] text-foreground"
      >
        {text}
      </p>
      {clamped && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-0.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          mais
        </button>
      )}
    </div>
  );
}
