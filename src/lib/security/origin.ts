/**
 * Reject cross-site state-changing requests when Origin/Referer is present
 * and does not match the app origin (CSRF defense-in-depth for cookie auth).
 */
export function assertSameOrigin(request: Request):
  | { ok: true }
  | { ok: false; status: number; error: string } {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host");

  if (!host) {
    return { ok: true };
  }

  const expected = new Set<string>();
  const proto =
    request.headers.get("x-forwarded-proto") === "http" ? "http" : "https";
  expected.add(`${proto}://${host}`);
  // Local dev
  expected.add(`http://${host}`);
  expected.add(`https://${host}`);

  const allowedExtra = process.env.ALLOWED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const o of allowedExtra ?? []) expected.add(o);

  if (origin) {
    if (!expected.has(origin)) {
      return { ok: false, status: 403, error: "Origem nao permitida." };
    }
    return { ok: true };
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!expected.has(refOrigin)) {
        return { ok: false, status: 403, error: "Origem nao permitida." };
      }
    } catch {
      return { ok: false, status: 403, error: "Origem nao permitida." };
    }
  }

  // No Origin/Referer (same-site navigation, curl, some mobile WebViews): allow.
  // Prefer Origin on browser POSTs; do not hard-fail missing headers in v1.
  return { ok: true };
}
