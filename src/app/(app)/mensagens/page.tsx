import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { PageHeader } from "@/components/nav/page-header";
import { InboxList } from "@/components/messages/inbox-list";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/session";
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
        <InboxList initialConversations={conversations} userId={user.id} />
      )}
    </div>
  );
}
