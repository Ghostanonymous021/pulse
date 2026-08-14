import { Capacitor } from "@capacitor/core";

/**
 * True only inside the Capacitor WebView (Android/iOS shell).
 * False on SSR, browsers, and the installed PWA.
 *
 * Do not treat this as a security boundary. RLS and the BFF still decide
 * who can do what. This is a UX/runtime switch (SW, chrome, plugins).
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** `android` | `ios` | `web` */
export function nativePlatform(): string {
  return Capacitor.getPlatform();
}
