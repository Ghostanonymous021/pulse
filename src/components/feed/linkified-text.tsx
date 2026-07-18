"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { contentSegments } from "@/lib/mentions/segments";
import { cn } from "@/lib/utils";

/**
 * Post body with clickable URLs and @mentions.
 * Same clamp behaviour as ExpandableText.
 */
export function LinkifiedText({
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
  const segments = contentSegments(text);

  useEffect(() => {
    if (expanded || open) {
      setClamped(false);
      return;
    }
    const el = ref.current;
    if (!el) return;
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded, open]);

  const content = segments.map((s, i) => {
    if (s.type === "url") {
      return (
        <a
          key={i}
          href={s.value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#007AFF] underline-offset-2 hover:underline dark:text-[#0A84FF]"
          onClick={(e) => e.stopPropagation()}
        >
          {s.value}
        </a>
      );
    }
    if (s.type === "mention") {
      return (
        <Link
          key={i}
          href={`/u/${encodeURIComponent(s.username)}`}
          className="font-medium text-[#007AFF] underline-offset-2 hover:underline dark:text-[#0A84FF]"
          onClick={(e) => e.stopPropagation()}
        >
          {s.value}
        </Link>
      );
    }
    return <span key={i}>{s.value}</span>;
  });

  if (expanded || open) {
    return (
      <p
        className={cn(
          "whitespace-pre-wrap text-[15px] leading-[1.5] tracking-[-0.01em] text-foreground",
          className,
        )}
      >
        {content}
      </p>
    );
  }

  return (
    <div className={className}>
      <p
        ref={ref}
        className="line-clamp-feed whitespace-pre-wrap text-[15px] leading-[1.5] tracking-[-0.01em] text-foreground"
      >
        {content}
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
