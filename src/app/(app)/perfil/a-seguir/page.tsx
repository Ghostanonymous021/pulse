import { PageHeader } from "@/components/nav/page-header";
import { PeopleList } from "@/components/profile/people-list";
import { requireProfile } from "@/lib/auth/session";
import { listFollowing } from "@/lib/social/follows";

export const metadata = { title: "A seguir" };

export default async function MeusASeguirPage() {
  const { supabase, profile } = await requireProfile();
  const people = await listFollowing(supabase, profile.id);

  return (
    <div>
      <PageHeader title="A seguir" backHref="/perfil" />
      <PeopleList people={people} />
    </div>
  );
}
