"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import {
  looksLikeEmail,
  looksLikePhone,
  normalizePhone,
  phoneToAuthEmail,
} from "@/lib/auth/phone";
import {
  isValidUsername,
  sanitizeUsernameInput,
  suggestUsernameFromName,
} from "@/lib/auth/username";
import {
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from "@/lib/security/password";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

type Availability = {
  checking: boolean;
  available: boolean | null;
  suggestions: string[];
  reason?: string;
};

type MultipleAccount = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [availability, setAvailability] = useState<Availability>({
    checking: false,
    available: null,
    suggestions: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [multipleAccounts, setMultipleAccounts] = useState<MultipleAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSuggestedFromName = useRef("");

  const checkUsername = useCallback(async (value: string) => {
    const clean = sanitizeUsernameInput(value);
    if (clean.length < 3) {
      setAvailability({
        checking: false,
        available: false,
        suggestions: [],
        reason: "curto",
      });
      return;
    }
    if (!isValidUsername(clean)) {
      setAvailability({
        checking: false,
        available: false,
        suggestions: [],
        reason: "formato",
      });
      return;
    }

    setAvailability((a) => ({ ...a, checking: true }));
    try {
      const res = await fetch(
        `/api/auth/username-check?u=${encodeURIComponent(clean)}`,
      );
      const data = (await res.json()) as {
        available?: boolean;
        suggestions?: string[];
        reason?: string;
        error?: string;
      };
      if (!res.ok) {
        setAvailability({
          checking: false,
          available: null,
          suggestions: [],
        });
        return;
      }
      setAvailability({
        checking: false,
        available: Boolean(data.available),
        suggestions: data.suggestions ?? [],
        reason: data.reason,
      });
    } catch {
      setAvailability({
        checking: false,
        available: null,
        suggestions: [],
      });
    }
  }, []);

  // Auto-suggest username from display name until user edits handle freely
  useEffect(() => {
    if (mode !== "signup") return;
    if (usernameTouched) return;
    const next = suggestUsernameFromName(displayName);
    if (next === lastSuggestedFromName.current) return;
    lastSuggestedFromName.current = next;
    setUsername(next);
  }, [displayName, mode, usernameTouched]);

  // Debounced availability
  useEffect(() => {
    if (mode !== "signup") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!username.trim()) {
      setAvailability({ checking: false, available: null, suggestions: [] });
      return;
    }
    debounceRef.current = setTimeout(() => {
      void checkUsername(username);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, mode, checkUsername]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setMultipleAccounts([]);

    const supabase = createClient();
    const value = identifier.trim();

    try {
      if (mode === "signup") {
        const pwErr = validatePassword(password);
        if (pwErr) throw new Error(pwErr);
        const cleanUsername = sanitizeUsernameInput(username);
        if (!isValidUsername(cleanUsername)) {
          throw new Error(
            "Username invalido. Usa 3–30 caracteres: a-z, 0-9, ponto ou _.",
          );
        }
        if (availability.available === false) {
          throw new Error("Esse username ja está em uso. Escolhe outro.");
        }

        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: value,
            password,
            display_name: displayName.trim() || undefined,
            username: cleanUsername,
          }),
        });
        const payload = (await res.json()) as {
          error?: string;
          login?:
            | { kind: "phone"; phone: string }
            | { kind: "email"; email: string };
        };

        if (!res.ok) {
          throw new Error(payload.error || "Não foi possível criar a conta.");
        }

        if (payload.login?.kind === "phone") {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: phoneToAuthEmail(payload.login.phone),
            password,
          });
          if (signInError) throw signInError;
        } else if (payload.login?.kind === "email") {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: payload.login.email,
            password,
          });
          if (signInError) throw signInError;
        }

        router.push("/onboarding");
        router.refresh();
        return;
      } else {
        // LOGIN
        if (looksLikePhone(value)) {
          // Verificar se tem múltiplas contas
          const checkRes = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              identifier: value,
              password,
            }),
          });

          const checkData = await checkRes.json();

          if (!checkRes.ok) {
            throw new Error(checkData.error || "Erro ao verificar contas.");
          }

          if (checkData.multipleAccounts && checkData.accounts?.length > 0) {
            // Mostrar seletor de contas
            setMultipleAccounts(checkData.accounts);
            setLoading(false);
            return;
          }

          // Login normal (1 conta ou email)
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: checkData.email || phoneToAuthEmail(normalizePhone(value)),
            password,
          });
          if (signInError) throw signInError;

        } else if (looksLikeEmail(value)) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: value.toLowerCase(),
            password,
          });
          if (signInError) throw signInError;
        } else {
          throw new Error("Usa um telefone ou e-mail valido.");
        }
      }

      router.push("/home");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? humanizeAuthError(err.message)
          : "Não foi possível continuar.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loginWithSelectedAccount(accountId: string) {
    if (!accountId || !password) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Buscar o email da conta selecionada
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", accountId)
        .single();

      if (!profile) {
        throw new Error("Conta não encontrada.");
      }

      // Fazer login com a senha (o Supabase usa o email associado)
      // Como temos o identifier, vamos usar a lógica normal de login
      const value = identifier.trim();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: phoneToAuthEmail(normalizePhone(value)),
        password,
      });

      if (signInError) throw signInError;

      router.push("/home");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao entrar na conta.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "signup" && (
        <>
          <Field
            label="Nome"
            id="display_name"
            value={displayName}
            onChange={setDisplayName}
            autoComplete="name"
            placeholder="Como queres aparecer"
            required
          />

          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                @
              </span>
              <input
                id="username"
                type="text"
                value={username}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                onChange={(e) => {
                  setUsernameTouched(true);
                  setUsername(sanitizeUsernameInput(e.target.value));
                }}
                className="h-12 w-full rounded-xl border border-border bg-card py-0 pl-8 pr-4 text-sm outline-none ring-foreground/10 placeholder:text-muted-foreground focus:ring-2"
              />
            </div>
            <UsernameStatus
              username={username}
              availability={availability}
            />
            {availability.available === false &&
              availability.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {availability.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setUsernameTouched(true);
                        setUsername(s);
                      }}
                      className="rounded-full border border-border bg-card px-2.5 py-1 text-[12px] font-medium tracking-[-0.01em] transition-colors hover:bg-muted"
                    >
                      @{s}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </>
      )}
      <Field
        label={mode === "signup" ? "Telefone" : "Telefone ou e-mail"}
        id="identifier"
        value={identifier}
        onChange={setIdentifier}
        autoComplete={mode === "signup" ? "tel" : "username"}
        inputMode={mode === "signup" ? "tel" : "text"}
        placeholder={mode === "signup" ? "84 000 0000" : undefined}
        required
      />
      <Field
        label="Palavra-passe"
        id="password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        required
        minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : 1}
        showPasswordToggle
        onTogglePassword={() => setShowPassword(!showPassword)}
        showPasswordValue={showPassword}
      />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {/* Seletor de múltiplas contas */}
      {multipleAccounts.length > 0 && mode === "login" && (
        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium text-muted-foreground">
            Este número tem {multipleAccounts.length} contas. Escolhe uma:
          </p>
          <div className="space-y-2">
            {multipleAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => loginWithSelectedAccount(account.id)}
                disabled={loading}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:bg-muted disabled:opacity-50"
              >
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium">
                  {account.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={account.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (account.display_name || account.username).charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {account.display_name || account.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{account.username}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setMultipleAccounts([]);
              setError(null);
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Voltar
          </button>
        </div>
      )}

      {!multipleAccounts.length && (
        <button
          type="submit"
          disabled={
            loading ||
            (mode === "signup" &&
              (availability.checking || availability.available === false))
          }
          className="flex h-12 w-full items-center justify-center rounded-xl bg-accent text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Aguarde..." : mode === "signup" ? "Continuar" : "Entrar"}
        </button>
      )}
    </form>
  );
}

function UsernameStatus({
  username,
  availability,
}: {
  username: string;
  availability: Availability;
}) {
  if (!username) {
    return (
      <p className="text-[12px] text-muted-foreground">
        Gerado a partir do nome — podes editar.
      </p>
    );
  }
  if (availability.checking) {
    return (
      <p className="text-[12px] text-muted-foreground">A verificar...</p>
    );
  }
  if (availability.reason === "formato" || availability.reason === "curto") {
    return (
      <p className="text-[12px] text-[#ff3b30]">
        3–30 caracteres: letras, numeros, ponto ou underscore.
      </p>
    );
  }
  if (availability.available === true) {
    return (
      <p className="text-[12px] text-emerald-600 dark:text-emerald-400">
        Disponivel
      </p>
    );
  }
  if (availability.available === false) {
    return (
      <p className="text-[12px] text-[#ff3b30]">
        Indisponivel
        {availability.suggestions.length > 0 ? " — escolhe uma opção:" : ""}
      </p>
    );
  }
  return null;
}

function humanizeAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Credenciais incorrectas.";
  }
  if (m.includes("already") || m.includes("registered")) {
    return "Ja existe uma conta com estes dados.";
  }
  if (m.includes("rate") || m.includes("demasiadas")) {
    return "Demasiadas tentativas. Tenta mais tarde.";
  }
  if (m.includes("username")) {
    return message;
  }
  return message;
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  required,
  minLength,
  optional,
  placeholder,
  showPasswordToggle = false,
  onTogglePassword,
  showPasswordValue,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  required?: boolean;
  minLength?: number;
  optional?: boolean;
  placeholder?: string;
  showPasswordToggle?: boolean;
  onTogglePassword?: () => void;
  showPasswordValue?: boolean;
}) {
  const isPassword = type === "password";
  const effectiveType = isPassword && showPasswordToggle && showPasswordValue ? "text" : type;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted-foreground">
            opcional
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={id}
          type={effectiveType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          inputMode={inputMode}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none ring-foreground/10 placeholder:text-muted-foreground focus:ring-2 pr-12"
        />
        {showPasswordToggle && isPassword && (
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPasswordValue ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
          >
            {showPasswordValue ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

