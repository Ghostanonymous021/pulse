"use client";

import { useEffect } from "react";

import { isNativeApp, nativePlatform } from "@/lib/native/runtime";

/**
 * Boots Capacitor plugins after the remote Next document is live.
 * No-op in the browser / PWA. Dynamic imports keep the plugins out of
 * the web critical path.
 */
export function NativeShell() {
  useEffect(() => {
    if (!isNativeApp()) return;

    const root = document.documentElement;
    root.dataset.pulseNative = nativePlatform();

    let removeBack: { remove: () => void } | undefined;
    let cancelled = false;

    void (async () => {
      const [{ StatusBar, Style }, { Keyboard, KeyboardResize }, { SplashScreen }, { App }] =
        await Promise.all([
          import("@capacitor/status-bar"),
          import("@capacitor/keyboard"),
          import("@capacitor/splash-screen"),
          import("@capacitor/app"),
        ]);

      if (cancelled) return;

      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
      } catch {
        /* older webviews */
      }

      try {
        // Visual Viewport + useKeyboardInset own the composer offset.
        // If the WebView also resizes, the tab bar and chat jump.
        await Keyboard.setResizeMode({ mode: KeyboardResize.None });
      } catch {
        /* android uses adjustNothing in the activity */
      }

      try {
        await SplashScreen.hide();
      } catch {
        /* ignore */
      }

      removeBack = await App.addListener("backButton", ({ canGoBack }) => {
        const path = window.location.pathname.replace(/\/$/, "") || "/";
        const atRoot =
          path === "/" ||
          path === "/home" ||
          path === "/login" ||
          path === "/signup";
        if (atRoot || !canGoBack) {
          void App.exitApp();
          return;
        }
        window.history.back();
      });
    })();

    return () => {
      cancelled = true;
      removeBack?.remove();
    };
  }, []);

  return null;
}
