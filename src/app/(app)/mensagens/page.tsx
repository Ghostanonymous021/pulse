import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { PageHeader } from "@/components/nav/page-header";
import { UserAvatar } from "@/components/profile/user-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/session";
import { inboxTimeLabel, messagePreview } from "@/lib/chat/preview";
import { listConversations, openDmWithUsername } from "@/lib/social/messages";

export const metadata = {
  title: "Mensagens",
};

export default async function MensagensPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; error?: string }>;
}) {
  const { to, error: errParam } = await searchParams;
  const { supabase, user } = await requireUser();

  let openError: string | null = errParam ?? null;

  if (to) {
    const result = await openDmWithUsername(supabase, to);
    if ("conversationId" in result) {
      redirect(`/mensagens/${result.conversationId}`);
    }
    openError = result.error;
  }

  const conversations = await listConversations(supabase, user.id);

  return (
    <div>
      <PageHeader title="Mensagens" />

      {openError && (
        <p className="border-b border-[var(--separator)] px-4 py-3 text-[13px] text-[#ff3b30]">
          {openError}
        </p>
      )}

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="As tuas conversas"
          description="Abre um perfil e toca em Mensagem."
          action={{ label: "Explorar", href: "/explorar" }}
        />
      ) : (
        <ul>
          {conversations.map((c) => {
            const preview = c.lastMessage
              ? messagePreview(c.lastMessage)
              : "Inicia a conversa";
            const prefix =
              c.lastMessage && c.lastMessage.sender_id === user.id
                ? "Tu: "
                : "";
            const time = c.lastMessage
              ? inboxTimeLabel(c.lastMessage.created_at)
              : null;

            return (
              <li key={c.id}>
                <Link
                  href={`/mensagens/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted/50 hover:bg-muted/35"
                >
                  <UserAvatar
                    userId={c.other.id}
                    avatarUrl={c.other.avatar_url}
                    name={c.other.display_name || c.other.username}
                    size={52}
                    className="ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                  />
                  <div className="min-w-0 flex-1 border-b border-[var(--separator)] pb-3 pt-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[16px] font-semibold tracking-[-0.02em]">
                        {c.other.display_name || c.other.username}
                      </p>
                      {time ? (
                        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                          {time}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[14px] text-muted-foreground">
                      {prefix}
                      {preview}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
