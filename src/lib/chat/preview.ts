import type { MessageType } from "@/lib/chat/types";

/** One-line preview for inbox rows and reply chips. */
export function messagePreview(input: {
  body: string | null;
  message_type?: MessageType | string | null;
  deleted_at?: string | null;
  /** Optional count when known (multi-media). */
  attachment_count?: number | null;
}): string {
  if (input.deleted_at) return "Mensagem apagada";
  const type = input.message_type ?? "text";
  const n = input.attachment_count ?? 0;
  if (type === "image") {
    if (n > 1) return `${n} fotos`;
    return "Foto";
  }
  if (type === "document") {
    if (n > 1) return `${n} documentos`;
    return "Documento";
  }
  if (type === "sticker") return "Sticker";
  if (type === "audio") return "Audio";
  const body = input.body?.trim();
  return body || "Mensagem";
}

export function inboxTimeLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startToday.getTime() - startMsg.getTime()) / 86400000,
  );

  if (diffDays === 0) {
    return d.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) {
    return d.toLocaleDateString("pt-PT", { weekday: "short" });
  }
  return d.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
  });
}
