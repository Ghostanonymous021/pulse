/** Active @mention under the caret (compose / comments). */

export type ActiveMention = {
  /** Index of `@` in the full text */
  start: number;
  /** Caret position (exclusive end of query) */
  end: number;
  /** Query after `@` (may be empty right after typing @) */
  query: string;
};

/**
 * Detect @query at caret. Triggers after `@` at start or after whitespace.
 * Does not trigger mid-email (e.g. a@b.com).
 */
export function getActiveMention(
  text: string,
  caret: number,
): ActiveMention | null {
  if (caret < 0 || caret > text.length) return null;

  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") {
      // Valid start: beginning or whitespace / punctuation openers
      if (i === 0 || /[\s(\[{]/.test(text[i - 1] ?? "")) {
        const query = text.slice(i + 1, caret);
        // Abort if query has whitespace (mention already closed)
        if (/\s/.test(query)) return null;
        // Allow empty query (just typed @)
        if (query.length > 30) return null;
        return { start: i, end: caret, query };
      }
      return null;
    }
    // Stop if we hit whitespace without finding @
    if (/\s/.test(ch)) return null;
    // Username-like chars only while scanning back
    if (!/[a-zA-Z0-9._]/.test(ch)) return null;
    i -= 1;
  }
  return null;
}

/** Insert selected username, replacing @query. Returns new text + caret. */
export function applyMention(
  text: string,
  active: ActiveMention,
  username: string,
): { text: string; caret: number } {
  const insert = `@${username} `;
  const next = text.slice(0, active.start) + insert + text.slice(active.end);
  return { text: next, caret: active.start + insert.length };
}

/** Extract @usernames from free text (for future notify-on-publish). */
export function extractMentionUsernames(text: string | null | undefined): string[] {
  if (!text) return [];
  const re = /(?:^|[\s(\[{])@([a-zA-Z0-9._]{1,30})\b/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const u = m[1].toLowerCase();
    if (!out.includes(u)) out.push(u);
  }
  return out;
}
