import { PageHeader } from "@/components/nav/page-header";
import { PeopleList } from "@/components/profile/people-list";
import { requireProfile } from "@/lib/auth/session";
import { listFollowers } from "@/lib/social/follows";

export const metadata = { title: "Seguidores" };

export default async function MeusSeguidoresPage() {
  const { supabase, profile } = await requireProfile();
  const people = await listFollowers(supabase, profile.id);

  return (
    <div>
      <PageHeader title="Seguidores" backHref="/perfil" />
      <PeopleList people={people} />
    </div>
  );
}
