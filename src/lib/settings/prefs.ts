import type { SupabaseClient } from "@supabase/supabase-js";

export type DmPermission = "everyone" | "following" | "none";

export type NotificationPrefs = {
  user_id: string;
  new_followers: boolean;
  likes: boolean;
  comments: boolean;
  messages: boolean;
  mentions: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: Omit<NotificationPrefs, "user_id"> = {
  new_followers: true,
  likes: true,
  comments: true,
  messages: true,
  mentions: true,
};

export async function getNotificationPrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "user_id, new_followers, likes, comments, messages, mentions",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Table may not exist yet if migration not applied
    return { user_id: userId, ...DEFAULT_NOTIFICATION_PREFS };
  }

  if (data) {
    return data as NotificationPrefs;
  }

  const row = { user_id: userId, ...DEFAULT_NOTIFICATION_PREFS };
  await supabase.from("notification_preferences").upsert(row);
  return row;
}

export async function listBlocked(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  }[]
> {
  const { data, error } = await supabase
    .from("blocks")
    .select(
      `
      blocked:profiles!blocks_blocked_id_fkey (
        id, username, display_name, avatar_url
      )
    `,
    )
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data
    .map((row) => {
      const p = Array.isArray(row.blocked) ? row.blocked[0] : row.blocked;
      return p as {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
      } | null;
    })
    .filter(Boolean) as {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  }[];
}
