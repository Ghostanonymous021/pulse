import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/nav/page-header";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { FollowButton } from "@/components/social/follow-button";
import { requireUser } from "@/lib/auth/session";
import { listProfileLinks } from "@/lib/links/profile-links";
import { loadFeedPosts } from "@/lib/posts/feed";
import { getFollowState } from "@/lib/social/follow";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (!profile) notFound();

  const p = profile as Profile;
  const isOwn = p.id === user.id;
  const followState = await getFollowState(supabase, user.id, p.id);

  // Simple verified-org analytics: count profile visits (not feed ranking)
  if (!isOwn && p.is_verified && p.account_type === "organizacao") {
    void supabase.rpc("increment_profile_view", { p_profile_id: p.id });
  }

  const canSeeContent =
    isOwn || !p.is_private || followState === "accepted";

  const targetFollowsMe =
    !isOwn && p.dm_permission === "following"
      ? (await getFollowState(supabase, p.id, user.id)) === "accepted"
      : false;

  const canMessage =
    !isOwn &&
    (p.dm_permission === "everyone" ||
      p.dm_permission == null ||
      (p.dm_permission === "following" && targetFollowsMe));

  const [
    { count: postsCount },
    { count: followersCount },
    { count: followingCount },
    posts,
    links,
  ] = await Promise.all([
    canSeeContent
      ? supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("author_id", p.id)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", p.id)
      .eq("status", "accepted"),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", p.id)
      .eq("status", "accepted"),
    canSeeContent
      ? loadFeedPosts(supabase, user.id, { authorId: p.id, limit: 40 })
      : Promise.resolve([]),
    listProfileLinks(supabase, p.id),
  ]);

  return (
    <div className="pb-4">
      <PageHeader
        title={p.display_name || p.username}
        backHref="/explorar"
      />

      <ProfileHeader
        profile={p}
        isOwn={isOwn}
        links={links}
        counts={{
          posts: postsCount ?? 0,
          followers: followersCount ?? 0,
          following: followingCount ?? 0,
        }}
      />

      {!isOwn && (
        <div
          className={cn(
            "mt-3 grid gap-2 px-4 pb-2",
            canMessage ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          <FollowButton targetUserId={p.id} initialState={followState} />
          {canMessage && (
            <Link
              href={`/mensagens?to=${p.username}`}
              className="flex h-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--separator)] text-[14px] font-medium transition-colors hover:bg-muted"
            >
              Mensagem
            </Link>
          )}
        </div>
      )}

      {!canSeeContent ? (
        <div className="mt-2 border-t border-[var(--separator)] px-4 py-16 text-center">
          <p className="text-[15px] font-medium tracking-[-0.02em]">
            Conta privada
          </p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Segue para ver as publicações.
          </p>
        </div>
      ) : (
        <ProfileTabs posts={posts} />
      )}
    </div>
  );
}
