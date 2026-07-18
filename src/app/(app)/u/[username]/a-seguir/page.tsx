import { notFound } from "next/navigation";

import { PageHeader } from "@/components/nav/page-header";
import { PeopleList } from "@/components/profile/people-list";
import { requireUser } from "@/lib/auth/session";
import { listFollowing } from "@/lib/social/follows";
import { getFollowState } from "@/lib/social/follow";
import type { Profile } from "@/types/database";

type Props = { params: Promise<{ username: string }> };

export default async function UserFollowingPage({ params }: Props) {
  const { username } = await params;
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (!profile) notFound();
  const p = profile as Profile;

  const follow = await getFollowState(supabase, user.id, p.id);
  const canSee =
    p.id === user.id || !p.is_private || follow === "accepted";

  if (!canSee) {
    return (
      <div>
        <PageHeader title="A seguir" backHref={`/u/${p.username}`} />
        <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
          Conta privada.
        </p>
      </div>
    );
  }

  const people = await listFollowing(supabase, p.id);

  return (
    <div>
      <PageHeader title="A seguir" backHref={`/u/${p.username}`} />
      <PeopleList people={people} />
    </div>
  );
}
