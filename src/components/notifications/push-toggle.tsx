"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

/**
 * Push notifications toggle — real OS notifications with sound/
 * vibration, on top of the in-app bell. Needs:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   (client)
 *   VAPID_PRIVATE_KEY              (server, used when actually
 *                                   sending — not part of this UI)
 * If the public key isn't configured, this renders nothing rather
 * than a broken toggle.
 */
export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!vapidKey) return;
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }

    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (cancelled) return;
        setSupported(true);
        setEnabled(Boolean(sub));
      })
      .catch(() => {
        if (!cancelled) setSupported(true);
      });
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  if (!vapidKey || !supported) return null;

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Permissão de notificações não concedida.");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidKey as string,
        ) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!res.ok) throw new Error("Falha ao guardar subscrição.");
      setEnabled(true);
    } catch {
      setError("Não foi possível ativar. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
    } catch {
      setError("Não foi possível desativar. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-[10px] border border-[var(--separator)] bg-card px-3.5 py-3">
      {enabled ? (
        <Bell className="h-4.5 w-4.5 shrink-0 text-foreground" strokeWidth={1.5} />
      ) : (
        <BellOff
          className="h-4.5 w-4.5 shrink-0 text-muted-foreground"
          strokeWidth={1.5}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">Notificações do dispositivo</p>
        <p className="text-[12px] text-muted-foreground">
          {enabled
            ? "Ativas — som e vibração incluídos."
            : "Recebe avisos mesmo com a app fechada."}
        </p>
        {error && <p className="mt-0.5 text-[12px] text-destructive">{error}</p>}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={enabled ? disable : enable}
        className="shrink-0 rounded-lg border border-[var(--separator)] px-3 py-1.5 text-[13px] font-medium transition-all duration-200 ease-out hover:bg-muted active:scale-95 disabled:opacity-50"
      >
        {enabled ? "Desativar" : "Ativar"}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
