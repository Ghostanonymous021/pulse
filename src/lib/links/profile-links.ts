import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileLink = {
  id: string;
  profile_id: string;
  rotulo: string;
  url: string;
  ordem: number;
  created_at: string;
};

export const MAX_PROFILE_LINKS = 5;

export async function listProfileLinks(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ProfileLink[]> {
  const { data, error } = await supabase
    .from("profile_links")
    .select("id, profile_id, rotulo, url, ordem, created_at")
    .eq("profile_id", profileId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listProfileLinks", error.message);
    return [];
  }
  return (data ?? []) as ProfileLink[];
}
