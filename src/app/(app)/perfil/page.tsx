import { Settings } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/nav/page-header";
import { ProfileCompleteBanner } from "@/components/profile/profile-complete-banner";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileStats } from "@/components/profile/profile-stats";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { requireProfile } from "@/lib/auth/session";
import { listProfileLinks } from "@/lib/links/profile-links";
import { loadFeedPosts } from "@/lib/posts/feed";
import {
  getProfileStats,
  isVerificationActive,
} from "@/lib/settings/verification";

export const metadata = {
  title: "Perfil",
};

export default async function PerfilPage() {
  const { supabase, profile } = await requireProfile();
  const verified = isVerificationActive(profile);
  const isOrg = profile.account_type === "organizacao";

  const [
    { count: postsCount },
    { count: followersCount },
    { count: followingCount },
    posts,
    stats,
    links,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("author_id", profile.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id)
      .eq("status", "accepted"),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id)
      .eq("status", "accepted"),
    loadFeedPosts(supabase, profile.id, { authorId: profile.id, limit: 40 }),
    verified && isOrg
      ? getProfileStats(supabase, profile.id)
      : Promise.resolve(null),
    listProfileLinks(supabase, profile.id),
  ]);

  return (
    <div className="pb-4">
      <PageHeader
        title={profile.display_name || profile.username}
        right={
          <Link
            href="/perfil/definicoes"
            aria-label="Definicoes"
            className="rounded-full p-2.5 text-foreground/80 transition-colors hover:bg-muted"
          >
            <Settings className="h-5 w-5" strokeWidth={1.5} />
          </Link>
        }
      />

      <ProfileHeader
        profile={profile}
        isOwn
        links={links}
        counts={{
          posts: postsCount ?? 0,
          followers: followersCount ?? 0,
          following: followingCount ?? 0,
        }}
      />

      <ProfileCompleteBanner profile={profile} />

      {stats && (
        <ProfileStats
          profileViews={stats.profile_views}
          postReach={stats.post_reach}
        />
      )}

      <ProfileTabs posts={posts} />
    </div>
  );
}
