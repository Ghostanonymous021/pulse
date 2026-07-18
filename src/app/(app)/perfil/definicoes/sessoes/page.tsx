import { PageHeader } from "@/components/nav/page-header";
import { SessionsPanel } from "@/components/settings/sessions-panel";
import { requireProfile } from "@/lib/auth/session";

export const metadata = { title: "Sessoes activas" };

export default async function SessoesPage() {
  const { user } = await requireProfile();

  return (
    <div className="pb-12">
      <PageHeader title="Sessoes activas" backHref="/perfil/definicoes" />
      <div className="pt-4">
        <SessionsPanel lastSignInAt={user.last_sign_in_at ?? null} />
      </div>
    </div>
  );
}
