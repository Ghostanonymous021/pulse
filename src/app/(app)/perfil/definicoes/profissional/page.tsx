import { ProfessionalFlow } from "@/components/settings/professional-flow";
import { requireProfile } from "@/lib/auth/session";
import { getLatestProfessionalRequest } from "@/lib/settings/professional";

export const metadata = { title: "Modo profissional" };

export default async function ProfissionalPage() {
  const { supabase, profile } = await requireProfile();
  const request = await getLatestProfessionalRequest(supabase, profile.id);

  return (
    <ProfessionalFlow
      initialRequest={request}
      isOrg={profile.account_type === "organizacao"}
    />
  );
}
