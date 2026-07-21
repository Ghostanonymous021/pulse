"use client";

import { useEffect, useState } from "react";
import { MonitorSmartphone, Smartphone } from "lucide-react";

import type { SessionRow } from "@/app/api/settings/sessions/route";
import { createClient } from "@/lib/supabase/client";

export function SessionsPanel({
  lastSignInAt,
}: {
  lastSignInAt: string | null;
}) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/sessions");
        const body = (await res.json()) as {
          sessions?: SessionRow[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || "Falha ao carregar.");
        if (!cancelled) setSessions(body.sessions ?? []);
      } catch {
        if (!cancelled) {
          setSessions([
            {
              id: "current",
              created_at: new Date().toISOString(),
              updated_at: lastSignInAt ?? new Date().toISOString(),
              user_agent:
                typeof navigator !== "undefined" ? navigator.userAgent : null,
              ip: null,
              is_current: true,
            },
          ]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lastSignInAt]);

  async function signOutEverywhere() {
    setError(null);
    setPending(true);
    try {
      await fetch("/api/settings/sessions", { method: "DELETE" });
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "global",
      });
      if (signOutError) throw signOutError;
      window.location.href = "/login";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível terminar.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <ul className="mx-4 overflow-hidden rounded-[12px] bg-card divide-y divide-[var(--separator)]">
        {sessions === null && (
          <li className="px-3.5 py-4 text-[14px] text-muted-foreground">
            A carregar...
          </li>
        )}
        {sessions?.length === 0 && (
          <li className="px-3.5 py-4 text-[14px] text-muted-foreground">
            Sem sessoes activas.
          </li>
        )}
        {sessions?.map((s) => {
          const label = deviceLabel(s.user_agent, s.is_current);
          const Icon = isMobileUa(s.user_agent)
            ? Smartphone
            : MonitorSmartphone;
          const when = formatWhen(s.updated_at);
          return (
            <li
              key={s.id}
              className="flex min-h-[56px] items-center gap-3 px-3.5 py-3"
            >
              <span
                className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-muted"
                aria-hidden
              >
                <Icon
                  className="h-[17px] w-[17px] text-foreground/85"
                  strokeWidth={1.5}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] tracking-[-0.01em]">{label}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {when}
                  {s.ip ? ` · ${s.ip}` : ""}
                </p>
              </div>
              {s.is_current ? (
                <span className="shrink-0 text-[13px] font-medium text-success">
                  Activa
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="px-4">
        <button
          type="button"
          disabled={pending}
          onClick={signOutEverywhere}
          className="flex min-h-12 w-full items-center justify-center rounded-[12px] bg-card px-4 text-[16px] font-medium tracking-[-0.01em] text-destructive transition-all duration-200 ease-out active:bg-muted/60 disabled:opacity-50"
        >
          {pending
            ? "A terminar..."
            : "Terminar sessão em todos os dispositivos"}
        </button>
        {error && (
          <p className="mt-2 text-center text-[13px] text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function isMobileUa(ua: string | null) {
  if (!ua) return true;
  return /Mobile|Android|iPhone|iPad/i.test(ua);
}

function deviceLabel(ua: string | null, isCurrent: boolean) {
  if (isCurrent && !ua) return "Este dispositivo";
  if (!ua) return "Dispositivo";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac OS X|Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return isCurrent ? "Este dispositivo" : "Dispositivo";
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-PT", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
