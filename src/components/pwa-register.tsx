"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";

import { isNativeApp } from "@/lib/native/runtime";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * PWA lifecycle:
 * - registers SW in production
 * - prompts install when browser fires beforeinstallprompt
 * - offers "Atualizar" when a new SW is waiting
 * - listens for background sync messages
 */
export function PwaRegister() {
  const [installEvt, setInstallEvt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Capacitor WebView: never install the PWA SW. A leftover registration
    // from a previous in-webview visit would fight HTTP cache + session.
    if (isNativeApp()) {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => {
            for (const r of regs) void r.unregister();
          })
          .catch(() => {});
      }
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) => {
            for (const key of keys) {
              if (key.startsWith("pulse-pwa-")) void caches.delete(key);
            }
          })
          .catch(() => {});
      }
      return;
    }

    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const onInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
      const dismissed = sessionStorage.getItem("pulse-install-dismissed");
      if (!dismissed) {
        window.setTimeout(() => {
          if (!cancelled) setShowInstall(true);
        }, 2500);
      }
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);

    const onAppInstalled = () => {
      setShowInstall(false);
      setInstallEvt(null);
    };
    window.addEventListener("appinstalled", onAppInstalled);

    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PULSE_BACKGROUND_SYNC") {
        window.dispatchEvent(new CustomEvent("pulse:background-sync"));
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const onFocus = () => {
      registration?.update().catch(() => {});
    };
    window.addEventListener("focus", onFocus);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((r) => {
        if (cancelled) return;
        registration = r;
        // Force check so critical SW fixes (e.g. offline loop) activate soon
        r.update().catch(() => {});

        // Auto-activate waiting SW (avoids stuck offline shell after deploy)
        if (r.waiting) {
          r.waiting.postMessage("SKIP_WAITING");
        }

        r.addEventListener("updatefound", () => {
          const sw = r.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              // Activate immediately; controllerchange reloads the page
              sw.postMessage("SKIP_WAITING");
              setWaitingWorker(sw);
              setNeedRefresh(true);
            }
          });
        });

        // Background Sync (Chrome) — notify clients when online again
        const syncManager = (
          r as ServiceWorkerRegistration & {
            sync?: { register: (tag: string) => Promise<void> };
          }
        ).sync;
        if (syncManager) {
          syncManager.register("pulse-sync").catch(() => {});
        }
      })
      .catch(() => {
        /* progressive enhancement */
      });

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("focus", onFocus);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  const acceptUpdate = useCallback(() => {
    waitingWorker?.postMessage("SKIP_WAITING");
    setNeedRefresh(false);
  }, [waitingWorker]);

  const install = useCallback(async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    const choice = await installEvt.userChoice;
    if (choice.outcome !== "accepted") {
      sessionStorage.setItem("pulse-install-dismissed", "1");
    }
    setShowInstall(false);
    setInstallEvt(null);
  }, [installEvt]);

  const dismissInstall = useCallback(() => {
    sessionStorage.setItem("pulse-install-dismissed", "1");
    setShowInstall(false);
  }, []);

  return (
    <>
      {needRefresh && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[80] flex justify-center px-3"
        >
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-[var(--separator)] bg-[var(--elevated)] px-3.5 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <p className="min-w-0 flex-1 text-[13px] tracking-[-0.01em] text-foreground">
              Nova versao pronta
            </p>
            <button
              type="button"
              onClick={acceptUpdate}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-accent-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Atualizar
            </button>
          </div>
        </div>
      )}

      {showInstall && installEvt && !needRefresh && (
        <div
          role="dialog"
          aria-label="Instalar Pulse"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[80] flex justify-center px-3"
        >
          <div className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border border-[var(--separator)] bg-[var(--elevated)] px-3.5 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <Download
              className="h-5 w-5 shrink-0 text-foreground/80"
              strokeWidth={1.75}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium tracking-[-0.01em]">
                Instalar Pulse
              </p>
              <p className="text-[12px] text-muted-foreground">
                Acesso rápido no ecrã inicial
              </p>
            </div>
            <button
              type="button"
              onClick={install}
              className="h-9 shrink-0 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-accent-foreground"
            >
              Instalar
            </button>
            <button
              type="button"
              onClick={dismissInstall}
              aria-label="Fechar"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
