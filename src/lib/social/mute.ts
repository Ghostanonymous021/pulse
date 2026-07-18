/** Client-side author mute for feed (v1 — local, per device). */

const KEY = "pulse:muted_authors";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify([...new Set(ids)]));
}

export function isAuthorMuted(authorId: string) {
  return read().includes(authorId);
}

export function muteAuthor(authorId: string) {
  write([...read(), authorId]);
}

export function unmuteAuthor(authorId: string) {
  write(read().filter((id) => id !== authorId));
}

export function listMutedAuthors() {
  return read();
}
