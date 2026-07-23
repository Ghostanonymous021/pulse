"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

import { PulseLoader } from "@/components/ui/pulse-loader";

/**
 * Offline shell — only shown when the network truly fails.
 * Hard-navigates home (bypasses soft client cache loops).
 */
export default function OfflinePage() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOnline(navigator.onLine);

    // If we already have network, leave immediately
    if (navigator.onLine) {
      const t = window.setTimeout(() => {
        window.location.replace("/home");
      }, 400);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    }

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (online) {
      window.location.replace("/home");
    }
  }, [online]);

  const retry = useCallback(async () => {
    setBusy(true);
    try {
      // Drop old SW caches that may trap the shell
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage("CLEAR_CACHES");
      }
      // Probe network with a tiny public asset
      await fetch(`/manifest.webmanifest?t=${Date.now()}`, {
        cache: "no-store",
      });
      window.location.replace(`/home?rejoin=${Date.now()}`);
    } catch {
      setBusy(false);
      setOnline(false);
    }
  }, []);

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-[18px] bg-muted"
        aria-hidden
      >
        <WifiOff className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
        {online ? "A reconectar..." : "Sem ligacao"}
      </h1>
      <p className="mt-2 max-w-[280px] text-[15px] leading-snug text-muted-foreground">
        {online
          ? "Rede detectada. A abrir o Pulse."
          : "O Pulse precisa de internet para o feed e as mensagens."}
      </p>
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[15px] font-semibold text-accent-foreground disabled:opacity-50"
      >
        {busy ? (
          <PulseLoader size="sm" />
        ) : (
          <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
        )}
        {busy ? "A tentar..." : "Tentar de novo"}
      </button>
    </main>
  );
}
