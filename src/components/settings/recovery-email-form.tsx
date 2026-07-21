"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { isSyntheticPhoneEmail } from "@/lib/auth/phone";
import { createClient } from "@/lib/supabase/client";

export function RecoveryEmailForm({
  initialEmail,
}: {
  initialEmail: string | null;
}) {
  const router = useRouter();
  const visible =
    initialEmail && !isSyntheticPhoneEmail(initialEmail) ? initialEmail : "";
  const [email, setEmail] = useState(visible);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value || !value.includes("@")) {
      setError("Indica um e-mail valido.");
      return;
    }
    setLoading(true);
    setMsg(null);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      await supabase.auth.updateUser({ email: value });
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ email: value })
        .eq("id", user.id);
      if (updateError) throw updateError;
      setMsg("E-mail guardado.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível guardar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 px-4 pt-2">
      <div>
        <label
          htmlFor="recovery_email"
          className="mb-1.5 block text-[13px] font-medium text-muted-foreground"
        >
          E-mail
        </label>
        <input
          id="recovery_email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@exemplo.com"
          autoComplete="email"
          className="h-12 w-full rounded-[12px] border-0 bg-card px-3.5 text-[16px] outline-none ring-1 ring-[var(--separator)] placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/20"
        />
      </div>
      {error && (
        <p className="text-[13px] text-destructive" role="alert">
          {error}
        </p>
      )}
      {msg && (
        <p className="text-[13px] text-muted-foreground" role="status">
          {msg}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="flex h-11 w-full items-center justify-center rounded-full bg-accent text-[15px] font-semibold tracking-[-0.02em] text-accent-foreground disabled:opacity-50"
      >
        {loading ? "A guardar..." : "Guardar"}
      </button>
    </form>
  );
}
