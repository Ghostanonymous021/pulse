import type { RankedItem } from "@/lib/ranking/types";

/**
 * Post-process: no two consecutive posts from the same author.
 * Does NOT mutate scores — only reorders the ranked list.
 *
 * Greedy: walk by score order; if next same author as last placed,
 * hold it and pick the next different author; re-queue held items.
 */
export function applyAuthorSpacing<T>(
  ranked: RankedItem<T>[],
): RankedItem<T>[] {
  if (ranked.length <= 1) return ranked;

  // Work on a copy sorted by score desc (stable)
  const queue = [...ranked].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return 0;
  });

  const out: RankedItem<T>[] = [];
  const held: RankedItem<T>[] = [];

  while (queue.length > 0 || held.length > 0) {
    // Prefer held items that no longer conflict
    let placed = false;
    if (held.length > 0) {
      const lastAuthor = out.length ? out[out.length - 1].author_id : null;
      const idx = held.findIndex((h) => h.author_id !== lastAuthor);
      if (idx >= 0) {
        out.push(held.splice(idx, 1)[0]);
        placed = true;
      }
    }

    if (placed) continue;

    if (queue.length === 0) {
      // Only same-author left — force-flush held
      out.push(...held);
      break;
    }

    const next = queue.shift()!;
    const lastAuthor = out.length ? out[out.length - 1].author_id : null;
    if (lastAuthor && next.author_id === lastAuthor) {
      held.push(next);
    } else {
      out.push(next);
    }
  }

  return out;
}
