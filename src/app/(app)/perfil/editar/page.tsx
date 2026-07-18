import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { ProfileLinksEditor } from "@/components/profile/profile-links-editor";
import { PageHeader } from "@/components/nav/page-header";
import { requireProfile } from "@/lib/auth/session";
import { listProfileLinks } from "@/lib/links/profile-links";

export const metadata = {
  title: "Editar perfil",
};

export default async function EditarPerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { supabase, profile } = await requireProfile();
  const params = await searchParams;
  const fromSettings = params.from === "definicoes";
  const links = await listProfileLinks(supabase, profile.id);

  return (
    <div>
      <PageHeader
        title="Editar perfil"
        backHref={fromSettings ? "/perfil/definicoes" : "/perfil"}
        backLabel={fromSettings ? "Definicoes" : "Cancelar"}
      />
      <EditProfileForm profile={profile} />
      <ProfileLinksEditor profileId={profile.id} initial={links} />
    </div>
  );
}
