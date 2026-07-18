import { PageHeader } from "@/components/nav/page-header";
import { DownloadDataButton } from "@/components/settings/download-data-button";
import { requireProfile } from "@/lib/auth/session";

export const metadata = { title: "Descarregar dados" };

export default async function DadosPage() {
  await requireProfile();

  return (
    <div className="pb-12">
      <PageHeader
        title="Descarregar os meus dados"
        backHref="/perfil/definicoes"
      />
      <DownloadDataButton />
    </div>
  );
}
