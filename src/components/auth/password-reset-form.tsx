"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordResetForm() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const value = identifier.trim().toLowerCase();

    try {
      let email = value;

      // Se for telefone, converter para formato de email do Supabase
      if (/^\d/.test(value)) {
        const cleanPhone = value.replace(/\D/g, "");
        email = `${cleanPhone}@pulse.app`;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/definir-nova-senha`,
        }
      );

      if (resetError) throw resetError;

      setSuccess(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível enviar o link. Tenta novamente.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold">Link enviado</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Verifica o teu telefone ou e-mail. O link é válido por 1 hora.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="identifier" className="text-sm font-medium">
          Telefone ou e-mail
        </label>
        <input
          id="identifier"
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="84 000 0000 ou teu@email.com"
          required
          className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none ring-foreground/10 placeholder:text-muted-foreground focus:ring-2"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !identifier.trim()}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-accent text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "A enviar..." : "Enviar link de recuperação"}
      </button>

      <p className="text-center text-[12px] text-muted-foreground">
        O link expira em 60 minutos.
      </p>
    </form>
  );
}
