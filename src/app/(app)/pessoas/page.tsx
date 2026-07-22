import { PageHeader } from "@/components/nav/page-header";
import { PeopleHub } from "@/components/social/people-hub";
import { requireProfile } from "@/lib/auth/session";
import { listFollowers, listFollowing } from "@/lib/social/follows";
import { loadPeopleSuggestions } from "@/lib/social/suggestions";

export const metadata = {
  title: "Pessoas",
};

/**
 * One screen for everything "who do I know here": PYMK suggestions
 * (see lib/social/suggestions.ts), plus the viewer's own followers and
 * following — previously three separate destinations (/pessoas,
 * /perfil/seguidores, /perfil/a-seguir) with no way to search any of
 * them. Full-network account search stays in Explorar; this is scoped
 * to people already connected to the viewer.
 */
export default async function PessoasPage() {
  const { supabase, profile } = await requireProfile();

  const [suggestions, followers, following] = await Promise.all([
    loadPeopleSuggestions(supabase, profile.id, {
      university: profile.university,
      campus: profile.campus,
      course: profile.course,
    }),
    listFollowers(supabase, profile.id),
    listFollowing(supabase, profile.id),
  ]);

  return (
    <div className="pb-4">
      <PageHeader title="Pessoas" />
      <PeopleHub
        suggestions={suggestions}
        followers={followers}
        following={following}
      />
    </div>
  );
}
