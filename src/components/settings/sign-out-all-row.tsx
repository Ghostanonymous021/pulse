"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { signOutEverywhere } from "@/lib/auth/sign-out";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Security action only: kill sessions on every device.
 * Default "Sair" uses SignOutRow (local scope).
 */
export function SignOutAllRow() {
  const router = useRouter();
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
      router.push("/login");
      router.refresh();
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
          "flex min-h-[48px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
          "active:bg-muted/60 hover:bg-muted/40 disabled:opacity-50",
        )}
      >
        <span
          className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-[#ff3b30]/10"
          aria-hidden
        >
          <LogOut className="h-[17px] w-[17px] text-[#ff3b30]" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] tracking-[-0.01em] text-[#ff3b30]">
            {loading
              ? "A terminar..."
              : "Terminar sessão em todos os dispositivos"}
          </span>
          <span className="block truncate text-[12px] text-[#ff3b30]/80">
            Inclui telemoveis e browsers
          </span>
        </span>
      </button>
    </li>
  );
}
