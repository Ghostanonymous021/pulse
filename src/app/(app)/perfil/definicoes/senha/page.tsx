import { PageHeader } from "@/components/nav/page-header";
import { PasswordForm } from "@/components/settings/password-form";
import { requireProfile } from "@/lib/auth/session";

export const metadata = { title: "Alterar senha" };

export default async function AlterarSenhaPage() {
  await requireProfile();

  return (
    <div className="pb-12">
      <PageHeader title="Alterar senha" backHref="/perfil/definicoes" />
      <PasswordForm />
    </div>
  );
}
