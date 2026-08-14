import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

/**
 * Pulse native shell.
 *
 * The WebView loads the production Next.js origin. This is intentional:
 * the app is App Router + cookie auth + BFF. Bundling a static export
 * would break middleware, Server Components, and SameSite cookies.
 *
 * Override the origin at sync time with PULSE_NATIVE_ORIGIN
 * (preview deploys). Never point this at a Vercel SSO-protected alias.
 */
const origin =
  process.env.PULSE_NATIVE_ORIGIN?.replace(/\/$/, "") ||
  "https://pulseax.vercel.app";

const host = new URL(origin).host;

const config: CapacitorConfig = {
  appId: "app.pulse.mobile",
  appName: "Pulse",
  webDir: "native/www",
  server: {
    url: origin,
    cleartext: false,
    androidScheme: "https",
    iosScheme: "https",
    hostname: host,
    allowNavigation: [host],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#09090b",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: true,
    },
    Keyboard: {
      resize: KeyboardResize.None,
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.PULSE_NATIVE_DEBUG === "1",
  },
};

export default config;
