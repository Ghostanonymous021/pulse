import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import type { FollowUiState } from "@/components/social/follow-button";
import { requireProfile } from "@/lib/auth/session";
import type { Profile } from "@/types/database";

export const metadata = {
  title: "Comecar",
};

/**
 * Professional multi-step onboarding after signup.
 * Entry: /onboarding — immersive (chrome none).
 */
export default async function OnboardingPage() {
  const { supabase, profile } = await requireProfile();

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

  const ids = (rows ?? []).map((r) => r.id);
  const { data: follows } = ids.length
    ? await supabase
        .from("follows")
        .select("following_id, status")
        .eq("follower_id", profile.id)
        .in("following_id", ids)
    : { data: [] as { following_id: string; status: string }[] };

  const followMap = new Map(
    (follows ?? []).map((f) => [f.following_id, f.status]),
  );

  const suggestions = ((rows ?? []) as Profile[]).map((r) => {
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

  return <OnboardingFlow profile={profile} suggestions={suggestions} />;
}
