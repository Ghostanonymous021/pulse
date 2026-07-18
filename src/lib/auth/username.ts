/** Username rules + suggestions for signup / edit profile. */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
/** Lowercase letters, digits, `.` and `_`. */
export const USERNAME_RE = /^[a-z0-9._]{3,30}$/;

export function stripAccents(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Keep only allowed characters; lowercase; no spaces. */
export function sanitizeUsernameInput(value: string) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/_{2,}/g, "_")
    .slice(0, USERNAME_MAX);
}

/**
 * From display name: "Lazaro Mahumana" → "lazaromahumana"
 */
export function suggestUsernameFromName(displayName: string, fallbackSeed?: string) {
  const joined = stripAccents(displayName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, USERNAME_MAX);

  if (joined.length >= USERNAME_MIN) return joined;

  const fromFallback = sanitizeUsernameInput(fallbackSeed || "");
  if (fromFallback.length >= USERNAME_MIN) return fromFallback.slice(0, USERNAME_MAX);

  return `user${Date.now().toString().slice(-6)}`;
}

export function isValidUsername(value: string) {
  if (!USERNAME_RE.test(value)) return false;
  if (value.startsWith(".") || value.endsWith(".")) return false;
  if (value.startsWith("_") || value.endsWith("_")) return false;
  if (value.includes("..") || value.includes("__")) return false;
  return true;
}

/**
 * Alternatives when the preferred handle is taken.
 * Always returns unique candidates the user can tap.
 */
export function usernameVariations(preferred: string, taken: Set<string> = new Set()) {
  const base = sanitizeUsernameInput(preferred) || "user";
  const parts = stripAccents(preferred)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const first = parts[0] || base.slice(0, 8);
  const rest = parts.slice(1).join("") || base.slice(first.length);
  const last = parts[parts.length - 1] || rest;
  const initial = rest ? rest[0] : "";

  const candidates: string[] = [
    base,
    `${base}1`,
    `${base}2`,
    `${base}3`,
    first && rest ? `${first}.${rest}` : "",
    first && rest ? `${first}_${rest}` : "",
    first && initial ? `${first}_${initial}` : "",
    first && last && first !== last ? `${first}.${last}` : "",
    first && last && first !== last ? `${first}_${last}` : "",
    `${base.slice(0, Math.min(base.length, 12))}_${Math.floor(Math.random() * 90 + 10)}`,
    `${first}${Math.floor(Math.random() * 900 + 100)}`,
  ];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of candidates) {
    const u = sanitizeUsernameInput(raw).slice(0, USERNAME_MAX);
    if (!isValidUsername(u)) continue;
    if (seen.has(u) || taken.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= 6) break;
  }

  // Guarantee at least one free-looking option with digits
  let n = 1;
  while (out.length < 3 && n < 1000) {
    const u = sanitizeUsernameInput(`${base}${n}`).slice(0, USERNAME_MAX);
    n += 1;
    if (!isValidUsername(u) || seen.has(u) || taken.has(u)) continue;
    seen.add(u);
    out.push(u);
  }

  return out;
}
