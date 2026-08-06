"use client";

import { useState } from "react";

import { PulseLoader } from "@/components/ui/pulse-loader";
import { createClient } from "@/lib/supabase/client";

/**
 * Requests a Supabase password-recovery link by e-mail.
 *
 * Product constraint (PULSE_VISAO_PRODUTO.md §7): cadastro e login sao
 * phone-first, sem SMS. Recuperacao de senha vive so no e-mail que a
 * pessoa configurou depois, dentro do app (settings/recovery-email-form.tsx)
 * — nunca por telefone. Por isso este ecra pede sempre um e-mail, nunca
 * telefone, e nunca revela se esse e-mail esta ou nao associado a uma conta
 * (evita enumeracao de contas).
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value || !value.includes("@")) {
      setError("Indica um e-mail valido.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(value, {
        redirectTo: `${window.location.origin}/recuperar/nova-senha`,
      });
      // Never branch on success/failure here — same message either way,
      // so a bad actor can't use this form to check which e-mails exist.
      setSent(true);
    } catch {
      setError("Nao foi possivel enviar o link agora. Tenta outra vez.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-1.5">
        <p className="text-[15px] leading-relaxed">
          Se esse e-mail estiver associado a uma conta, enviamos um link para
          repor a senha.
        </p>
        <p className="text-[13px] text-muted-foreground">
          Verifica tambem o spam. O link expira em pouco tempo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="recovery_email" className="text-sm font-medium">
          E-mail de recuperacao
        </label>
        <input
          id="recovery_email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@exemplo.com"
          autoComplete="email"
          autoFocus
          required
          className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none ring-foreground/10 placeholder:text-muted-foreground focus:ring-2"
        />
        <p className="text-[13px] text-muted-foreground">
          So funciona se ja tiveres configurado um e-mail de recuperacao nas
          definicoes da conta.
        </p>
      </div>

      {error && (
        <p className="shake text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-brand-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95 disabled:opacity-50"
      >
        {loading && <PulseLoader size="sm" />}
        {loading ? "A enviar..." : "Enviar link"}
      </button>
    </form>
  );
}
