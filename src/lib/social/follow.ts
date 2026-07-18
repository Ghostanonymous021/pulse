import type { SupabaseClient } from "@supabase/supabase-js";

import type { FollowUiState } from "@/components/social/follow-button";

export async function getFollowState(
  supabase: SupabaseClient,
  viewerId: string,
  targetId: string,
): Promise<FollowUiState> {
  if (viewerId === targetId) return "self";

  const { data } = await supabase
    .from("follows")
    .select("status")
    .eq("follower_id", viewerId)
    .eq("following_id", targetId)
    .maybeSingle();

  if (!data) return "none";
  return data.status === "pending" ? "pending" : "accepted";
}

/** Instagram method: going public accepts all pending requests. */
export async function acceptPendingFollowsOnPublic(
  supabase: SupabaseClient,
  userId: string,
) {
  await supabase
    .from("follows")
    .update({ status: "accepted" })
    .eq("following_id", userId)
    .eq("status", "pending");
}
