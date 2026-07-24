import { ComposeForm } from "@/components/compose/compose-form";
import { requireProfile } from "@/lib/auth/session";
import { isVerificationActive } from "@/lib/settings/verification";

export const metadata = {
  title: "Publicar",
};

// ComposeForm gera a sua propria barra superior (Cancelar / Publicar) —
// nao empilhar com PageHeader (regra: uma unica barra por ecra).
export default async function PostarPage() {
  const { profile } = await requireProfile();
  const isOrg = profile.account_type === "organizacao";
  const weeklyLimit =
    isOrg && isVerificationActive(profile) ? 6 : isOrg ? 3 : 0;

  return (
    <ComposeForm
      canHighlight={isOrg}
      highlightWeeklyLimit={weeklyLimit || 3}
    />
  );
}
