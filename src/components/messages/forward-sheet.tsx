"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { forwardMessage } from "@/lib/chat/actions";
import type { ChatMessage } from "@/lib/chat/types";
import { UserAvatar } from "@/components/profile/user-avatar";
import { listConversations, type ConversationListItem } from "@/lib/social/messages";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Bottom sheet: pick a conversation to forward a message into. */
export function ForwardSheet({
  message,
  userId,
  onClose,
}: {
  message: ChatMessage;
  userId: string;
  onClose: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    void listConversations(supabase, userId).then((items) => {
      setConversations(items);
      setLoading(false);
    });
  }, [userId]);

  async function handlePick(conversationId: string) {
    setSendingTo(conversationId);
    const supabase = createClient();
    const result = await forwardMessage(supabase, message, conversationId, userId);
    setSendingTo(null);
    if (result.ok) {
      setSentTo((prev) => new Set(prev).add(conversationId));
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 max-h-[75vh] w-full max-w-lg overflow-hidden rounded-t-2xl bg-[var(--elevated)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between border-b border-[var(--separator)] px-4 py-3">
          <p className="text-[15px] font-semibold tracking-[-0.02em]">
            Reencaminhar para
          </p>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              A carregar conversas...
            </p>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              Sem conversas para reencaminhar.
            </p>
          ) : (
            conversations.map((c) => {
              const sent = sentTo.has(c.id);
              const sending = sendingTo === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={sending}
                  onClick={() => void handlePick(c.id)}
                  className="flex w-full items-center gap-3 border-b border-[var(--separator)] px-4 py-3 text-left last:border-b-0 hover:bg-muted/40 disabled:opacity-60"
                >
                  <UserAvatar
                    userId={c.other.id}
                    avatarUrl={c.other.avatar_url}
                    name={c.other.display_name}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      {c.other.display_name}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      @{c.other.username}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[12px] font-medium",
                       sent ? "text-success" : "text-brand",
                    )}
                  >
                    {sending ? "..." : sent ? "Enviado" : "Enviar"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
