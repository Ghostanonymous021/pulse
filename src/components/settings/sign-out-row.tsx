"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { signOutThisDevice } from "@/lib/auth/sign-out";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Default exit: this device only.
 * "Terminar em todos" stays as SignOutAllRow under Security.
 */
export function SignOutRow() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      await signOutThisDevice(supabase);
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
          className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-muted"
          aria-hidden
        >
          <LogOut
            className="h-[17px] w-[17px] text-foreground/85"
            strokeWidth={1.5}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] tracking-[-0.01em]">
            {loading ? "A sair..." : "Sair"}
          </span>
          <span className="block truncate text-[12px] text-muted-foreground">
            So neste dispositivo
          </span>
        </span>
      </button>
    </li>
  );
}
