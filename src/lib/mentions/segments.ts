import { linkifySegments } from "@/lib/links/urls";

export type TextSegment =
  | { type: "text"; value: string }
  | { type: "url"; value: string }
  | { type: "mention"; value: string; username: string };

const MENTION_IN_TEXT = /@([a-zA-Z0-9._]{1,30})\b/g;

/**
 * Split free text into text / url / @mention segments for display.
 * URLs take precedence via linkify first, then mentions inside text runs.
 */
export function contentSegments(text: string): TextSegment[] {
  const base = linkifySegments(text);
  const out: TextSegment[] = [];

  for (const part of base) {
    if (part.type === "url") {
      out.push({ type: "url", value: part.value });
      continue;
    }
    let last = 0;
    const re = new RegExp(MENTION_IN_TEXT.source, "g");
    let m: RegExpExecArray | null;
    const chunk = part.value;
    while ((m = re.exec(chunk)) !== null) {
      if (m.index > last) {
        out.push({ type: "text", value: chunk.slice(last, m.index) });
      }
      out.push({
        type: "mention",
        value: m[0],
        username: m[1],
      });
      last = m.index + m[0].length;
    }
    if (last < chunk.length) {
      out.push({ type: "text", value: chunk.slice(last) });
    }
  }

  return out.length ? out : [{ type: "text", value: text }];
}
