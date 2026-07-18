"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * End all sessions — invalidates refresh tokens (scope: global), not just local storage.
 * Icon stays inside this client component (cannot pass Lucide icons from Server Components).
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
      await supabase.auth.signOut({ scope: "global" });
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
        <span className="min-w-0 flex-1 truncate text-[16px] tracking-[-0.01em] text-[#ff3b30]">
          {loading
            ? "A terminar..."
            : "Terminar sessao em todos os dispositivos"}
        </span>
      </button>
    </li>
  );
}
