/**
 * Avatar URL helpers — keep one public path per user and bust caches
 * so feed, chat, comments, and profile stay in sync after change.
 */

/** Stable storage object path (always same key → upsert replaces bytes). */
export function avatarStoragePath(userId: string) {
  return `${userId}/avatar.jpg`;
}

/**
 * Strip prior bust params and attach a stable version query.
 * Prefer profiles.updated_at (or a timestamp) so all clients refresh together.
 */
export function withAvatarCacheBust(
  avatarUrl: string | null | undefined,
  version?: string | number | null,
): string | null {
  if (!avatarUrl) return null;
  const base = avatarUrl.split("?")[0] ?? avatarUrl;
  if (!version) return base;
  const v = String(version)
    .replace(/[^\w.-]/g, "")
    .slice(0, 32);
  if (!v) return base;
  return `${base}?v=${v}`;
}

/**
 * Deterministic fallback tone per user — same person always gets the
 * same tint, so a contact list without photos still reads as distinct
 * people (Apple Contacts / iMessage pattern), without introducing a new
 * saturated color palette. Every tone is a neutral variant derived from
 * the existing --foreground/--muted-foreground scale, just at different
 * opacities — no new hue enters the design system.
 */
const AVATAR_FALLBACK_TONES = [
  "bg-foreground/12 text-foreground/70",
  "bg-foreground/16 text-foreground/75",
  "bg-foreground/10 text-foreground/65",
  "bg-foreground/20 text-foreground/80",
  "bg-foreground/8 text-foreground/60",
  "bg-foreground/14 text-foreground/72",
  "bg-foreground/18 text-foreground/78",
  "bg-foreground/9 text-foreground/62",
] as const;

/** Stable small hash — not cryptographic, just needs even distribution. */
function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Tailwind class pair (bg + text) for a user's avatar fallback, stable
 * for the lifetime of their `userId`. Use together with the initial
 * letter when there is no photo.
 */
export function avatarFallbackTone(userId: string): string {
  if (!userId) return AVATAR_FALLBACK_TONES[0];
  const idx = hashString(userId) % AVATAR_FALLBACK_TONES.length;
  return AVATAR_FALLBACK_TONES[idx];
}

/** Public event after own avatar changes (client components re-sync). */
export const AVATAR_CHANGED_EVENT = "pulse:avatar-changed";

export type AvatarChangedDetail = {
  userId: string;
  avatarUrl: string;
  version: string;
};

export function emitAvatarChanged(detail: AvatarChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AVATAR_CHANGED_EVENT, { detail }),
  );
  try {
    sessionStorage.setItem(
      `pulse:avatar:${detail.userId}`,
      JSON.stringify({
        url: detail.avatarUrl,
        version: detail.version,
        at: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
}

export function readCachedAvatar(
  userId: string,
): { url: string; version: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`pulse:avatar:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { url?: string; version?: string };
    if (!parsed.url) return null;
    return {
      url: parsed.url,
      version: parsed.version || String(Date.now()),
    };
  } catch {
    return null;
  }
}
