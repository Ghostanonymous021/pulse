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
