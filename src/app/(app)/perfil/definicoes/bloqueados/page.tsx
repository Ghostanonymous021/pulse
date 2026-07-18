import { PageHeader } from "@/components/nav/page-header";
import { BlockedList } from "@/components/settings/blocked-list";
import { requireProfile } from "@/lib/auth/session";
import { listBlocked } from "@/lib/settings/prefs";

export const metadata = { title: "Contas bloqueadas" };

export default async function BloqueadosPage() {
  const { supabase, profile } = await requireProfile();
  const people = await listBlocked(supabase, profile.id);

  return (
    <div className="pb-12">
      <PageHeader title="Contas bloqueadas" backHref="/perfil/definicoes" />
      <BlockedList people={people} />
    </div>
  );
}
