import { Settings } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/nav/page-header";
import { ProfileCompleteBanner } from "@/components/profile/profile-complete-banner";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { requireProfile } from "@/lib/auth/session";
import { listProfileLinks } from "@/lib/links/profile-links";
import { loadFeedPosts } from "@/lib/posts/feed";
import type { WorkspaceWithMeta } from "@/lib/workspaces/types";

export const metadata = {
  title: "Perfil",
};

export default async function PerfilPage() {
  const { supabase, profile } = await requireProfile();

  const [
    { count: postsCount },
    { count: followersCount },
    { count: followingCount },
    posts,
    links,
    workspaces,
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
    listProfileLinks(supabase, profile.id),
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);

  const workspaceList: WorkspaceWithMeta[] = (workspaces ?? []).map((p) => ({
    ...p,
    members_count: 0,
    entries_count: 0,
    stars_count: 0,
    viewer_role: "owner" as const,
    viewer_starred: false,
    members: [],
  }));

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

      <ProfileTabs
        posts={posts}
        workspaceCount={workspaceList.length}
        workspaces={workspaceList}
        isOwn
      />
    </div>
  );
}
