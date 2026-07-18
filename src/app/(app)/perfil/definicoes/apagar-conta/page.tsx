import { PageHeader } from "@/components/nav/page-header";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { requireProfile } from "@/lib/auth/session";

export const metadata = { title: "Apagar conta" };

export default async function ApagarContaPage() {
  await requireProfile();

  return (
    <div className="pb-12">
      <PageHeader title="Apagar conta" backHref="/perfil/definicoes" />
      <DeleteAccountForm />
    </div>
  );
}
