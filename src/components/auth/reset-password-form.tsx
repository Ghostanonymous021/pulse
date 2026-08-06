"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordInput } from "@/components/ui/password-input";
import { PulseLoader } from "@/components/ui/pulse-loader";
import { PASSWORD_MIN_LENGTH, validatePassword } from "@/lib/security/password";
import { createClient } from "@/lib/supabase/client";

type SessionState = "checking" | "ready" | "invalid";

/**
 * Second half of the Supabase recovery-link flow. The link from
 * ForgotPasswordForm lands here with a recovery session already set by the
 * Supabase client (PKCE code exchange happens automatically via
 * detectSessionInUrl); we just wait for the PASSWORD_RECOVERY auth event
 * before letting the person set a new password. If the link is missing,
 * expired, or already used, there is no recovery session and we say so —
 * never silently show a broken form.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setSession("ready");
      }
    });

    // Some browsers fire the event before this effect subscribes; if a
    // session already exists by the time we mount, trust it too.
    supabase.auth.getSession().then(({ data }) => {
      if (!settled && data.session) {
        settled = true;
        setSession("ready");
      } else if (!settled) {
        // Give the URL-driven exchange a moment before declaring it invalid.
        setTimeout(() => {
          if (!settled) setSession("invalid");
        }, 2500);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const pwErr = validatePassword(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (password !== confirm) {
      setError("As senhas nao coincidem.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => {
        router.push("/home");
        router.refresh();
      }, 1500);
    } catch {
      setError("Nao foi possivel repor a senha. Tenta outra vez.");
    } finally {
      setLoading(false);
    }
  }

  if (session === "checking") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <PulseLoader size="sm" />A verificar o link...
      </div>
    );
  }

  if (session === "invalid") {
    return (
      <div className="space-y-1.5">
        <p className="text-[15px] leading-relaxed">
          Este link ja nao e valido. Pode ter expirado ou ja ter sido usado.
        </p>
        <p className="text-[13px] text-muted-foreground">
          Pede um novo link de recuperacao e tenta de novo.
        </p>
      </div>
    );
  }

  if (done) {
    return <p className="text-[15px] leading-relaxed">Senha actualizada.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="new_password" className="text-sm font-medium">
          Nova senha
        </label>
        <PasswordInput
          id="new_password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          autoFocus
          required
          minLength={PASSWORD_MIN_LENGTH}
          className="h-12 w-full rounded-xl border border-border bg-card pl-4 text-sm outline-none ring-foreground/10 placeholder:text-muted-foreground focus:ring-2"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm_password" className="text-sm font-medium">
          Confirmar
        </label>
        <PasswordInput
          id="confirm_password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          className="h-12 w-full rounded-xl border border-border bg-card pl-4 text-sm outline-none ring-foreground/10 placeholder:text-muted-foreground focus:ring-2"
        />
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
        {loading ? "A guardar..." : "Repor senha"}
      </button>
    </form>
  );
}
