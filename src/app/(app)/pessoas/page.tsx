import { PageHeader } from "@/components/nav/page-header";
import { PeopleSuggestions } from "@/components/social/people-suggestions";
import { requireProfile } from "@/lib/auth/session";
import { loadPeopleSuggestions } from "@/lib/social/suggestions";

export const metadata = {
  title: "Pessoas",
};

/**
 * "Pessoas que talvez conheças" — Facebook PYMK pattern (see
 * lib/social/suggestions.ts for the ranking signals). Reachable from the
 * primary tab bar so discovery isn't limited to onboarding-only.
 */
export default async function PessoasPage() {
  const { supabase, profile } = await requireProfile();

  const suggestions = await loadPeopleSuggestions(supabase, profile.id, {
    university: profile.university,
    campus: profile.campus,
    course: profile.course,
  });

  return (
    <div className="pb-4">
      <PageHeader title="Pessoas que talvez conheças" />
      <PeopleSuggestions suggestions={suggestions} />
    </div>
  );
}
