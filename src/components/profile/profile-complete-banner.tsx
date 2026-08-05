"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { profileCompletion } from "@/lib/profile/completeness";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

const dismissKey = (id: string) => `pulse:profile-banner-dismissed:${id}`;

/**
 * Banner de "termina de configurar o perfil" — dispensavel.
 *
 * Antes ficava sempre visivel, sem escolha: se o utilizador nao quisesse
 * completar o perfil (ou so quisesse mais tarde), nao havia forma de o
 * tirar dali. Agora tem um X: ao dispensar, guarda a escolha (localStorage,
 * por perfil) e nao volta a aparecer nesse dispositivo ate o perfil mudar
 * e passar a incompleto de novo por outro motivo — nesse caso a chave
 * antiga simplesmente deixa de fazer sentido e o banner reaparece.
 */
export function ProfileCompleteBanner({ profile }: { profile: Profile }) {
  const { complete, percent, gaps } = profileCompletion(profile);
  // null = ainda nao sabemos se ja foi dispensado (aguarda o efeito, so
  // existe no cliente). Evita mostrar o banner e faze-lo sumir logo a seguir.
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(dismissKey(profile.id)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [profile.id]);

  if (complete || dismissed === null || dismissed) return null;

  const hint = gaps
    .slice(0, 3)
    .map((g) => g.label)
    .join(", ");

  function handleDismiss() {
    setClosing(true);
    try {
      localStorage.setItem(dismissKey(profile.id), "1");
    } catch {
      // localStorage indisponivel (ex.: modo privado) — a dispensa nao
      // persiste entre sessoes, mas a acao em si nao fica bloqueada.
    }
    window.setTimeout(() => setDismissed(true), 200);
  }

  return (
    <div
      className={cn(
        "mx-4 mt-3 overflow-hidden transition-all duration-200 ease-out",
        closing ? "max-h-0 opacity-0" : "max-h-28 opacity-100",
      )}
    >
      <div className="relative flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--separator)] bg-muted/40 py-3 pl-3.5 pr-10">
        <Link
          href="/perfil/editar?from=definicoes"
          className="flex min-w-0 flex-1 items-center gap-3 transition-opacity duration-200 ease-out hover:opacity-80"
        >
          <div className="relative h-9 w-9 shrink-0">
            <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-muted"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${(percent / 100) * 94} 94`}
                strokeLinecap="round"
                className="text-foreground"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums">
              {percent}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium tracking-[-0.02em]">
              Termina de configurar o perfil
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              Falta {hint}
              {gaps.length > 3 ? "…" : ""}
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dispensar"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 ease-out hover:bg-muted hover:text-foreground active:scale-90"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
