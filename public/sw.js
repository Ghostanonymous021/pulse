/* Pulse PWA service worker v4
 *
 * IMPORTANT for auth apps:
 * - Do NOT aggressively intercept HTML navigations (false "offline" loops).
 * - Static assets only: Cache First / SWR.
 * - Navigations: network-only; offline page only on real network failure.
 */
const VERSION = "pulse-pwa-v4";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;

const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // addAll fails entirely if one URL fails — add one by one
      for (const url of PRECACHE) {
        try {
          await cache.add(url);
        } catch {
          /* skip missing in dev */
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("pulse-") && !k.startsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("pulse-")).map((k) => caches.delete(k))),
      ),
    );
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "pulse-sync") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        for (const c of clients) {
          c.postMessage({ type: "PULSE_BACKGROUND_SYNC" });
        }
      }),
    );
  }
});

// Real push notifications — sound + vibration come from the OS/browser
// once a Notification is shown; we don't control the sound file itself,
// only trigger it via showNotification.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Pulse", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Pulse";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-maskable-192.png",
    vibrate: [80, 40, 80],
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/notificacoes" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notificacoes";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = clientsList.find((c) => "focus" in c);
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: "PULSE_NOTIFICATION_CLICK", url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never touch API / Next data / image optimizer / auth
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/_next/image")
  ) {
    return;
  }

  if (req.headers.get("range")) return;

  // Navigations: prefer live network. Offline page only if fetch truly fails.
  if (req.mode === "navigate" || req.destination === "document") {
    // Never "offline-fallback" the offline page itself into a loop
    if (url.pathname === "/offline" || url.pathname.startsWith("/offline/")) {
      return; // default network
    }
    event.respondWith(navigationNetworkOnly(req));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }

  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }

  if (url.pathname === "/manifest.webmanifest" || url.pathname === "/sw.js") {
    event.respondWith(staleWhileRevalidate(req, SHELL));
  }
});

async function navigationNetworkOnly(req) {
  try {
    // Full request as-is (cookies, redirects). No artificial timeout —
    // middleware + Supabase auth can exceed 4s on slow networks.
    return await fetch(req);
  } catch {
    // Real offline / DNS / connection refused only
    const offline = await caches.match("/offline");
    if (offline) return offline;
    return new Response(
      "<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\"><title>Pulse</title><body style=\"font-family:system-ui;padding:2rem;text-align:center;background:#0a0a0b;color:#f5f5f7\"><h1>Sem ligação</h1><p>Toca em tentar de novo quando a rede voltar.</p><p><a href=\"/home\" style=\"color:#7B6CFF\">Tentar de novo</a></p></body>",
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return hit || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || network;
}
