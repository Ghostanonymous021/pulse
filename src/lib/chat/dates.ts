/** WhatsApp-style day labels in Portuguese. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startToday.getTime() - startMsg.getTime()) / 86400000,
  );

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) {
    return d.toLocaleDateString("pt-PT", { weekday: "long" });
  }
  return d.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export type ChatRow =
  | { kind: "day"; id: string; label: string }
  | { kind: "message"; id: string; messageId: string };

export function buildChatRows(
  messages: { id: string; created_at: string }[],
): ChatRow[] {
  const rows: ChatRow[] = [];
  let lastDay: string | null = null;
  for (const m of messages) {
    const day = dayLabel(m.created_at);
    if (day !== lastDay) {
      rows.push({ kind: "day", id: `day-${m.created_at.slice(0, 10)}`, label: day });
      lastDay = day;
    }
    rows.push({ kind: "message", id: m.id, messageId: m.id });
  }
  return rows;
}
