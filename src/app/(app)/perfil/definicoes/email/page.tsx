import { PageHeader } from "@/components/nav/page-header";
import { RecoveryEmailForm } from "@/components/settings/recovery-email-form";
import { isSyntheticPhoneEmail } from "@/lib/auth/phone";
import { requireProfile } from "@/lib/auth/session";

export const metadata = { title: "E-mail de recuperacao" };

export default async function EmailRecuperacaoPage() {
  const { profile } = await requireProfile();
  const recoveryEmail =
    profile.email && !isSyntheticPhoneEmail(profile.email)
      ? profile.email
      : null;

  return (
    <div className="pb-12">
      <PageHeader title="E-mail de recuperacao" backHref="/perfil/definicoes" />
      <RecoveryEmailForm initialEmail={recoveryEmail} />
    </div>
  );
}
