"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
  type TextareaHTMLAttributes,
  type InputHTMLAttributes,
} from "react";

import {
  applyMention,
  getActiveMention,
  type ActiveMention,
} from "@/lib/mentions/active";
import {
  searchMentionCandidates,
  type MentionCandidate,
} from "@/lib/mentions/search";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Common = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Dropdown above the field (comments bar) vs below (compose) */
  listPlacement?: "above" | "below";
};

type TextareaProps = Common &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
    as?: "textarea";
  };

type InputProps = Common &
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
    as: "input";
  };

/**
 * Text field with Instagram-style @ mention suggestions.
 * Filters profiles as the user types after @.
 */
export function MentionField(props: TextareaProps | InputProps) {
  const {
    value,
    onChange,
    className,
    listPlacement = "below",
    as = "textarea",
    ...rest
  } = props;

  const listId = useId();
  const fieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const [active, setActive] = useState<ActiveMention | null>(null);
  const [items, setItems] = useState<MentionCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshActive = useCallback((text: string, caret: number) => {
    setActive(getActiveMention(text, caret));
  }, []);

  useEffect(() => {
    if (!active) {
      setItems([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const supabase = createClient();
          const rows = await searchMentionCandidates(supabase, active.query);
          setItems(rows);
          setHighlight(0);
        } finally {
          setLoading(false);
        }
      })();
    }, 160);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [active]);

  function pick(user: MentionCandidate) {
    if (!active) return;
    const { text, caret } = applyMention(value, active, user.username);
    onChange(text);
    setActive(null);
    setItems([]);
    requestAnimationFrame(() => {
      const el = fieldRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (!active || items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + items.length) % items.length);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(items[highlight] ?? items[0]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setActive(null);
      setItems([]);
    }
  }

  function handleChange(
    next: string,
    caret: number | null,
  ) {
    onChange(next);
    if (caret != null) refreshActive(next, caret);
  }

  const showList = Boolean(active) && (loading || items.length > 0);

  const list = showList ? (
    <ul
      id={listId}
      role="listbox"
      aria-label="Mencoes"
      className={cn(
        "absolute left-0 right-0 z-40 max-h-56 overflow-y-auto rounded-[12px] border border-[var(--separator)] bg-[var(--elevated)] py-1 shadow-[0_8px_28px_rgba(0,0,0,0.12)] backdrop-blur-xl",
        listPlacement === "above" ? "bottom-full mb-1.5" : "top-full mt-1.5",
      )}
    >
      {loading && items.length === 0 && (
        <li className="px-3 py-2.5 text-[13px] text-muted-foreground">
          A procurar...
        </li>
      )}
      {!loading && items.length === 0 && active && (
        <li className="px-3 py-2.5 text-[13px] text-muted-foreground">
          {active.query
            ? "Ninguem que segues com esse nome"
            : "Segue alguem para mencionar"}
        </li>
      )}
      {items.map((u, i) => (
        <li key={u.id} role="option" aria-selected={i === highlight}>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
              i === highlight ? "bg-muted" : "hover:bg-muted/70",
            )}
            onMouseEnter={() => setHighlight(i)}
            onMouseDown={(e) => {
              // prevent blur before click
              e.preventDefault();
              pick(u);
            }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-muted-foreground">
              {(u.display_name || u.username).slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium tracking-[-0.01em]">
                {u.display_name || u.username}
              </span>
              <span className="block truncate text-[12px] text-muted-foreground">
                @{u.username}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  const shared = {
    ref: fieldRef as never,
    value,
    "aria-autocomplete": "list" as const,
    "aria-controls": showList ? listId : undefined,
    "aria-expanded": showList,
    onKeyDown,
    onSelect: (e: SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const t = e.currentTarget;
      refreshActive(t.value, t.selectionStart ?? t.value.length);
    },
    onClick: (e: SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const t = e.currentTarget;
      refreshActive(t.value, t.selectionStart ?? t.value.length);
    },
    onBlur: () => {
      // Delay so mousedown on list can fire first
      setTimeout(() => {
        setActive(null);
        setItems([]);
      }, 120);
    },
  };

  return (
    <div className="relative w-full">
      {listPlacement === "above" && list}
      {as === "input" ? (
        <input
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
          {...shared}
          className={className}
          onChange={(e) =>
            handleChange(e.target.value, e.target.selectionStart)
          }
        />
      ) : (
        <textarea
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          {...shared}
          className={className}
          onChange={(e) =>
            handleChange(e.target.value, e.target.selectionStart)
          }
        />
      )}
      {listPlacement === "below" && list}
    </div>
  );
}
