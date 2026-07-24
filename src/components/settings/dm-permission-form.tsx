"use client";

import { useState } from "react";

import type { DmPermission } from "@/lib/settings/prefs";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const OPTIONS: { value: DmPermission; label: string }[] = [
  { value: "everyone", label: "Todos" },
  { value: "following", label: "Só quem sigo" },
  { value: "none", label: "Só quem já fala contigo" },
];

export function DmPermissionForm({
  initial,
}: {
  initial: DmPermission;
}) {
  const [value, setValue] = useState<DmPermission>(initial);
  const [pending, setPending] = useState(false);

  async function select(next: DmPermission) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no session");

      const { error } = await supabase
        .from("profiles")
        .update({ dm_permission: next })
        .eq("id", user.id);
      if (error) throw error;
    } catch {
      setValue(prev);
    } finally {
      setPending(false);
    }
  }

  return (
    <ul className="mx-4 overflow-hidden rounded-[12px] bg-card divide-y divide-[var(--separator)]">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <li key={opt.value}>
            <button
              type="button"
              disabled={pending}
              onClick={() => select(opt.value)}
              className={cn(
                "flex min-h-[48px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-all duration-200 ease-out",
                "active:bg-muted/60 hover:bg-muted/40 disabled:opacity-60",
              )}
            >
              <span className="text-[16px] tracking-[-0.01em]">{opt.label}</span>
              {selected ? (
                <Check
                  className="h-5 w-5 shrink-0 text-foreground"
                  strokeWidth={2}
                  aria-hidden
                />
              ) : (
                <span className="h-5 w-5 shrink-0" aria-hidden />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
