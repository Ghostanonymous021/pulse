"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const IOS_HINT_DISMISS_KEY = "pulse-ios-install-dismissed";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari iOS: propriedade nao-standard, sem equivalente no matchMedia
    // em versoes mais antigas do iOS.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  // Chrome/Firefox/Edge no iOS sao todos WebKit por baixo (regra da Apple),
  // mas so o Safari em si tem acesso ao "Adicionar ao ecra principal" —
  // browsers de terceiros no iOS nao conseguem, entao instruir so confunde.
  const isThirdPartyIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && !isThirdPartyIosBrowser;
}

/**
 * PWA lifecycle:
 * - registers SW in production
 * - prompts install when browser fires beforeinstallprompt (Chromium)
 * - no iOS Safari, mostra instrucoes manuais — a plataforma nao expoe
 *   nenhuma API programatica, "Adicionar ao ecra principal" so existe
 *   dentro do menu de partilha do proprio Safari.
 * - offers "Atualizar" when a new SW is waiting
 * - listens for background sync messages
 */
export function PwaRegister() {
  const [installEvt, setInstallEvt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );

  // Convite manual para iOS Safari — independente do registo do SW,
  // corre em qualquer ambiente (nao so producao), porque so depende
  // de deteccao de plataforma, nao de nenhuma capacidade do browser.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || !isIosSafari()) return;
    try {
      if (localStorage.getItem(IOS_HINT_DISMISS_KEY) === "1") return;
    } catch {
      // localStorage indisponivel — mostra na mesma, so nao persiste a dispensa.
    }
    const t = window.setTimeout(() => setShowIosHint(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  const dismissIosHint = useCallback(() => {
    try {
      localStorage.setItem(IOS_HINT_DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setShowIosHint(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const onInstallPrompt = (e: Event) => {
      e.preventDefault();
      if (isStandalone()) return;
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
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 text-[13px] font-semibold text-brand-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95"
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
              strokeWidth={1.5}
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
              className="h-9 shrink-0 rounded-full bg-brand px-3.5 text-[13px] font-semibold text-brand-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95"
            >
              Instalar
            </button>
            <button
              type="button"
              onClick={dismissInstall}
              aria-label="Fechar"
              className="rounded-full p-1.5 text-muted-foreground transition-all duration-200 ease-out hover:bg-muted active:scale-90"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {showIosHint && !needRefresh && (
        <div
          role="dialog"
          aria-label="Instalar Pulse no iPhone"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[80] flex justify-center px-3"
        >
          <div className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border border-[var(--separator)] bg-[var(--elevated)] px-3.5 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <Share
              className="h-5 w-5 shrink-0 text-foreground/80"
              strokeWidth={1.5}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium tracking-[-0.01em]">
                Instalar Pulse
              </p>
              <p className="text-[12px] text-muted-foreground">
                Toca em Partilhar e depois &quot;Adicionar ao ecrã inicial&quot;
              </p>
            </div>
            <button
              type="button"
              onClick={dismissIosHint}
              aria-label="Fechar"
              className="rounded-full p-1.5 text-muted-foreground transition-all duration-200 ease-out hover:bg-muted active:scale-90"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
