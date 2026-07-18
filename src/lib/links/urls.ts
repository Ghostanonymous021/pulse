/** Extract http(s) URLs from free text (first pass for auto-link + unfurl). */

const URL_RE =
  /https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]]/gi;

export function extractUrls(text: string | null | undefined, max = 3): string[] {
  if (!text) return [];
  const found = text.match(URL_RE) ?? [];
  const unique: string[] = [];
  for (const raw of found) {
    const cleaned = raw.replace(/[),.]+$/g, "");
    if (!unique.includes(cleaned) && unique.length < max) {
      unique.push(cleaned);
    }
  }
  return unique;
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function normalizeUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Split text into segments for auto-linking in the UI.
 */
export function linkifySegments(
  text: string,
): { type: "text" | "url"; value: string }[] {
  const segments: { type: "text" | "url"; value: string }[] = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ type: "text", value: text.slice(last, m.index) });
    }
    const cleaned = m[0].replace(/[),.]+$/g, "");
    segments.push({ type: "url", value: cleaned });
    last = m.index + cleaned.length;
    // If we stripped trailing punctuation, leave it as text next loop via last index
    if (cleaned.length < m[0].length) {
      // punctuation already after cleaned; re.exec advanced past full match —
      // include stripped chars as text
      const stripped = m[0].slice(cleaned.length);
      if (stripped) segments.push({ type: "text", value: stripped });
      last = m.index + m[0].length;
    }
  }
  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }
  return segments.length ? segments : [{ type: "text", value: text }];
}
