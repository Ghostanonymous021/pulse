"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

import { signOutEverywhere } from "@/lib/auth/sign-out";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function SignOutAllRow() {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/settings/sessions", { method: "DELETE" }).catch(
        () => null,
      );
      const supabase = createClient();
      await signOutEverywhere(supabase);
      window.location.href = "/login";
    } catch {
      setLoading(false);
    }
  }

  return (
    <li>
      <button
        type="button"
        disabled={loading}
        onClick={onClick}
        className={cn(
          "flex min-h-[48px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-all duration-200 ease-out",
          "active:bg-muted/60 hover:bg-muted/40 disabled:opacity-50",
        )}
      >
        <span
          className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-destructive/10"
          aria-hidden
        >
          <LogOut className="h-[17px] w-[17px] text-destructive" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] tracking-[-0.01em] text-destructive">
            {loading
              ? "A terminar..."
              : "Terminar sessão em todos os dispositivos"}
          </span>
          <span className="block truncate text-[12px] text-destructive/80">
            Inclui telemoveis e browsers
          </span>
        </span>
      </button>
    </li>
  );
}
