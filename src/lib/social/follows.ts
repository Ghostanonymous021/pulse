import type { SupabaseClient } from "@supabase/supabase-js";

import type { Profile } from "@/types/database";

export type FollowListPerson = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url" | "university" | "campus"
>;

export async function listFollowers(
  supabase: SupabaseClient,
  userId: string,
): Promise<FollowListPerson[]> {
  const { data, error } = await supabase
    .from("follows")
    .select(
      `
      follower:profiles!follows_follower_id_fkey (
        id, username, display_name, avatar_url, university, campus
      )
    `,
    )
    .eq("following_id", userId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("listFollowers", error?.message);
    return [];
  }

  return data
    .map((row) => {
      const p = Array.isArray(row.follower) ? row.follower[0] : row.follower;
      return p as FollowListPerson | null;
    })
    .filter(Boolean) as FollowListPerson[];
}

export async function listFollowing(
  supabase: SupabaseClient,
  userId: string,
): Promise<FollowListPerson[]> {
  const { data, error } = await supabase
    .from("follows")
    .select(
      `
      following:profiles!follows_following_id_fkey (
        id, username, display_name, avatar_url, university, campus
      )
    `,
    )
    .eq("follower_id", userId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("listFollowing", error?.message);
    return [];
  }

  return data
    .map((row) => {
      const p = Array.isArray(row.following)
        ? row.following[0]
        : row.following;
      return p as FollowListPerson | null;
    })
    .filter(Boolean) as FollowListPerson[];
}
