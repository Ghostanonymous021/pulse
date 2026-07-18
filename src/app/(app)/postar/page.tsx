import { ComposeForm } from "@/components/compose/compose-form";
import { PageHeader } from "@/components/nav/page-header";
import { requireProfile } from "@/lib/auth/session";
import { isVerificationActive } from "@/lib/settings/verification";

export const metadata = {
  title: "Publicar",
};

export default async function PostarPage() {
  const { profile } = await requireProfile();
  const isOrg = profile.account_type === "organizacao";
  const weeklyLimit =
    isOrg && isVerificationActive(profile) ? 6 : isOrg ? 3 : 0;

  return (
    <div>
      <PageHeader title="Nova publicacao" />
      <ComposeForm
        canHighlight={isOrg}
        highlightWeeklyLimit={weeklyLimit || 3}
      />
    </div>
  );
}
