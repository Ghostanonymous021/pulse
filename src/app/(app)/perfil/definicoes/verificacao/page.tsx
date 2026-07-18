import { VerificationFlow } from "@/components/settings/verification-flow";
import { requireProfile } from "@/lib/auth/session";

export const metadata = {
  title: "Verificacao",
};

export default async function VerificacaoPage() {
  const { profile } = await requireProfile();

  return <VerificationFlow profile={profile} />;
}
