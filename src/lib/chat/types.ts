export type MessageType = "text" | "image" | "document" | "sticker" | "audio";

export type ChatAttachment = {
  id: string;
  storage_path: string;
  mime_type: string;
  file_name: string | null;
  size_bytes: number | null;
  kind: "image" | "document" | "sticker" | "audio";
  url?: string | null;
  /** Optional duration in seconds (voice notes). */
  duration_sec?: number | null;
};

export type ChatReaction = {
  emoji: string;
  user_id: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  message_type: MessageType;
  reply_to_id: string | null;
  deleted_at: string | null;
  created_at: string;
  attachments: ChatAttachment[];
  reactions: ChatReaction[];
  reply_preview?: {
    id: string;
    body: string | null;
    sender_id: string;
    message_type: MessageType;
    deleted: boolean;
  } | null;
  /** Client-only: optimistic send still in flight */
  pending?: boolean;
  /** Client-only: send failed */
  failed?: boolean;
  /** Client-only: upload progress 0–100 (WhatsApp-style) */
  upload_progress?: number;
};

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

/** Large stickers (user content) — emoji set, no external assets. */
export const STICKER_PACK = [
  "😀", "😎", "🥳", "😍", "🤝", "💪",
  "🔥", "✨", "🎉", "📚", "🎓", "☕",
  "😂", "😅", "🙌", "👏", "💯", "🚀",
] as const;
