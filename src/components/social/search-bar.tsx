"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Explorar search field.
 *
 * Previously: a bare <input type="search"> with no visible affordance
 * to trigger it — worked only via the keyboard Enter key (native form
 * submit), which is invisible on touch keyboards that hide the return
 * key label. This adds:
 *   - a leading search glyph (Apple/Spotlight convention: icon = this
 *     field searches, no separate button needed)
 *   - live results as you type (debounced client navigation, no full
 *     page reload) — trailing Enter still works, it is just no longer
 *     required
 *   - a clear (x) affordance once there is text
 */
export function SearchBar({
  defaultValue,
  tab,
}: {
  defaultValue: string;
  tab: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  function navigate(q: string) {
    startTransition(() => {
      router.replace(
        `/explorar?q=${encodeURIComponent(q)}&tab=${tab}`,
        { scroll: false },
      );
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(next), 300);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(value);
  }

  function clear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue("");
    navigate("");
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={onSubmit} className="px-4 pt-3" role="search">
      <label htmlFor="q" className="sr-only">
        Pesquisar
      </label>
      <div
        className={cn(
          "flex h-10 items-center gap-2 rounded-full border border-[var(--separator)] bg-muted/60 px-3.5 transition-shadow focus-within:ring-2 focus-within:ring-foreground/10",
        )}
      >
        <Search
          className="h-[17px] w-[17px] shrink-0 text-muted-foreground"
          strokeWidth={2}
        />
        <input
          ref={inputRef}
          id="q"
          name="q"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Pesquisar"
          autoFocus
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            aria-label="Limpar pesquisa"
            onClick={clear}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/15 text-foreground/70"
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </form>
  );
}
