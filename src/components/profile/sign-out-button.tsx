"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signOutThisDevice } from "@/lib/auth/sign-out";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const supabase = createClient();
      await signOutThisDevice(supabase);
      router.push("/login");
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-medium transition-all duration-200 ease-out hover:bg-muted active:scale-95 disabled:opacity-50"
    >
      {loading ? "A sair..." : "Sair"}
    </button>
  );
}
