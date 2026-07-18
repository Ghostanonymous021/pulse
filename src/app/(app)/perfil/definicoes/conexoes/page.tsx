import { PageHeader } from "@/components/nav/page-header";
import { ManageConnections } from "@/components/settings/manage-connections";
import { requireProfile } from "@/lib/auth/session";
import { listFollowers, listFollowing } from "@/lib/social/follows";

export const metadata = { title: "Seguidores e a seguir" };

export default async function ConexoesPage() {
  const { supabase, profile } = await requireProfile();
  const [followers, following] = await Promise.all([
    listFollowers(supabase, profile.id),
    listFollowing(supabase, profile.id),
  ]);

  return (
    <div className="pb-12">
      <PageHeader title="Seguidores e a seguir" backHref="/perfil/definicoes" />
      <ManageConnections
        followers={followers}
        following={following}
        userId={profile.id}
      />
    </div>
  );
}
