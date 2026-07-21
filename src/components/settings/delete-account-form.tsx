"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CONSEQUENCES = [
  "Perfil e dados de conta",
  "Publicações e fotos",
  "Mensagens e conversas",
  "Seguidores, pedidos e bloqueios",
  "Comentarios e curtidas",
];

export function DeleteAccountForm() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    confirm.trim().toLowerCase() === "apagar" && password.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "apagar", password }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error || "Não foi possível apagar a conta.");
      }
      router.push("/login");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível apagar a conta.",
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 px-4 pt-2">
      <ul className="overflow-hidden rounded-[12px] bg-card divide-y divide-[var(--separator)]">
        {CONSEQUENCES.map((line) => (
          <li
            key={line}
            className="px-3.5 py-3 text-[15px] tracking-[-0.01em] text-foreground/90"
          >
            {line}
          </li>
        ))}
      </ul>

      <div>
        <label
          htmlFor="confirm_delete"
          className="mb-1.5 block text-[13px] font-medium text-muted-foreground"
        >
          Escreve apagar para confirmar
        </label>
        <input
          id="confirm_delete"
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          className="h-12 w-full rounded-[12px] border-0 bg-card px-3.5 text-[16px] outline-none ring-1 ring-[var(--separator)] focus:ring-2 focus:ring-foreground/20"
        />
      </div>

      <div>
        <label
          htmlFor="delete_password"
          className="mb-1.5 block text-[13px] font-medium text-muted-foreground"
        >
          Senha actual
        </label>
        <input
          id="delete_password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="h-12 w-full rounded-[12px] border-0 bg-card px-3.5 text-[16px] outline-none ring-1 ring-[var(--separator)] focus:ring-2 focus:ring-foreground/20"
        />
      </div>

      {error && (
        <p className="shake text-[13px] text-destructive" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || loading}
        className="flex h-12 w-full items-center justify-center rounded-full bg-destructive text-[15px] font-semibold tracking-[-0.02em] text-white transition-all duration-200 ease-out active:scale-95 disabled:opacity-40"
      >
        {loading ? "A apagar..." : "Apagar conta permanentemente"}
      </button>
    </form>
  );
}
