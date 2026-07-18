import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Block SSRF to private/link-local/metadata addresses when fetching user URLs.
 * Only https is allowed for link previews.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function ipIsPrivate(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::1" || v === "0:0:0:0:0:0:0:1") return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:")) {
    return true;
  }
  // IPv4-mapped IPv6
  const mapped = v.match(/^:ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipIsPrivate(mapped[1]);

  const parts = v.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => n >= 0 && n <= 255)) {
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true;
  }
  return false;
}

export type SafeUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

export async function assertSafeOutboundUrl(
  raw: string,
): Promise<SafeUrlResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "url_invalida" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "apenas_https" };
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: "host_bloqueado" };
  }

  if (host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "host_bloqueado" };
  }

  // Literal IP in hostname
  if (isIP(host)) {
    if (ipIsPrivate(host)) {
      return { ok: false, reason: "ip_privado" };
    }
    return { ok: true, url };
  }

  try {
    const records = await lookup(host, { all: true, verbatim: true });
    if (!records.length) {
      return { ok: false, reason: "dns_vazio" };
    }
    for (const r of records) {
      if (ipIsPrivate(r.address)) {
        return { ok: false, reason: "ip_privado" };
      }
    }
  } catch {
    return { ok: false, reason: "dns_falhou" };
  }

  return { ok: true, url };
}

/** Max redirects when fetching OG (prevent open redirect chains to internal). */
export const OG_MAX_REDIRECTS = 3;
