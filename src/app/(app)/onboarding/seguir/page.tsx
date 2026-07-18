import { redirect } from "next/navigation";

import { SuggestFollows } from "@/components/onboarding/suggest-follows";
import { requireProfile } from "@/lib/auth/session";
import type { FollowUiState } from "@/components/social/follow-button";
import type { Profile } from "@/types/database";

export const metadata = {
  title: "Sugestoes para seguir",
};

/**
 * After signup: suggested accounts (IG pattern).
 * Affinity under the hood: campus / course / university when declared.
 */
export default async function OnboardingSeguirPage() {
  const { supabase, profile } = await requireProfile();

  // Prefer same campus/course/uni; fall back to recent public people + orgs
  let query = supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, university, campus, course, account_type, is_private",
    )
    .neq("id", profile.id)
    .limit(30);

  if (profile.campus) {
    query = query.eq("campus", profile.campus);
  } else if (profile.course) {
    query = query.eq("course", profile.course);
  } else if (profile.university) {
    query = query.eq("university", profile.university);
  }

  let { data: rows } = await query;

  if (!rows?.length) {
    const fallback = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, university, campus, course, account_type, is_private",
      )
      .neq("id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    rows = fallback.data;
  }

  if (!rows?.length) {
    // Nothing to suggest — go home
    redirect("/home");
  }

  const ids = rows.map((r) => r.id);
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id, status")
    .eq("follower_id", profile.id)
    .in("following_id", ids);

  const followMap = new Map(
    (follows ?? []).map((f) => [f.following_id, f.status]),
  );

  const suggestions = (rows as Profile[]).map((r) => {
    const st = followMap.get(r.id);
    let followState: FollowUiState = "none";
    if (st === "pending") followState = "pending";
    if (st === "accepted") followState = "accepted";
    return {
      id: r.id,
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      university: r.university,
      campus: r.campus,
      course: r.course,
      account_type: r.account_type,
      followState,
    };
  });

  return <SuggestFollows suggestions={suggestions} />;
}
