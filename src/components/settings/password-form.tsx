"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { phoneToAuthEmail } from "@/lib/auth/phone";
import {
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from "@/lib/security/password";
import { createClient } from "@/lib/supabase/client";

/**
 * Two steps — never dump current + new + confirm all at once.
 * 1) prove current password
 * 2) set new password
 */
export function PasswordForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<"current" | "next">("current");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verifyCurrent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);

    if (!current) {
      setError("Indica a senha actual.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessao expirada.");

      const authEmail =
        user.email ||
        (user.phone ? phoneToAuthEmail(user.phone) : null);
      if (!authEmail) throw new Error("Conta sem identificador de login.");

      // Re-auth with current password before allowing change
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: current,
      });
      if (signInError) {
        throw new Error("Senha actual incorrecta.");
      }

      setPhase("next");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nao foi possivel verificar.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);

    const pwErr = validatePassword(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (password !== confirm) {
      setError("As senhas nao coincidem.");
      return;
    }
    if (password === current) {
      setError("A nova senha deve ser diferente.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      setCurrent("");
      setPassword("");
      setConfirm("");
      setPhase("current");
      setMsg("Senha actualizada.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nao foi possivel alterar.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (phase === "current") {
    return (
      <form onSubmit={verifyCurrent} className="space-y-4 px-4 pt-2">
        <Field
          id="current_password"
          label="Senha actual"
          type="password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          autoFocus
        />
        {error && (
          <p className="text-[13px] text-[#ff3b30]" role="alert">
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
          {loading ? "A verificar..." : "Continuar"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={setNewPassword} className="space-y-4 px-4 pt-2">
      <Field
        id="new_password"
        label="Nova senha"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        autoFocus
        minLength={PASSWORD_MIN_LENGTH}
      />
      <Field
        id="confirm_password"
        label="Confirmar"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />
      {error && (
        <p className="text-[13px] text-[#ff3b30]" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setError(null);
            setPassword("");
            setConfirm("");
            setPhase("current");
          }}
          className="flex h-11 flex-1 items-center justify-center rounded-full bg-muted text-[15px] font-medium tracking-[-0.02em] disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex h-11 flex-1 items-center justify-center rounded-full bg-accent text-[15px] font-semibold tracking-[-0.02em] text-accent-foreground disabled:opacity-50"
        >
          {loading ? "A guardar..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  autoFocus,
  minLength,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
  minLength?: number;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-medium text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="h-12 w-full rounded-[12px] border-0 bg-card px-3.5 text-[16px] outline-none ring-1 ring-[var(--separator)] placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/20"
      />
    </div>
  );
}
