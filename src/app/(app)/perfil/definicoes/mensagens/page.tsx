import { PageHeader } from "@/components/nav/page-header";
import { DmPermissionForm } from "@/components/settings/dm-permission-form";
import { requireProfile } from "@/lib/auth/session";
import type { DmPermission } from "@/lib/settings/prefs";

export const metadata = { title: "Mensagens" };

export default async function QuemPodeMensagemPage() {
  const { profile } = await requireProfile();
  const initial = (profile.dm_permission ?? "everyone") as DmPermission;

  return (
    <div className="pb-12">
      <PageHeader
        title="Quem pode enviar mensagem"
        backHref="/perfil/definicoes"
      />
      <div className="pt-4">
        <DmPermissionForm initial={initial} />
      </div>
    </div>
  );
}
