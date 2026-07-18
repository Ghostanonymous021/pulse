import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  NotificationActor,
  NotificationRow,
  NotificationView,
} from "@/lib/notifications/types";

export async function countUnreadNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("countUnreadNotifications", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function loadNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 40,
): Promise<NotificationView[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, recipient_id, type, actor_id, reference_id, actor_ids, actor_count, is_read, created_at, updated_at",
    )
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("loadNotifications", error.message);
    return [];
  }

  const rows = (data ?? []) as NotificationRow[];
  const actorIdSet = new Set<string>();
  for (const r of rows) {
    if (r.actor_id) actorIdSet.add(r.actor_id);
    for (const id of r.actor_ids ?? []) actorIdSet.add(id);
  }

  const actors = new Map<string, NotificationActor>();
  if (actorIdSet.size) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", [...actorIdSet]);
    for (const p of profiles ?? []) {
      actors.set(p.id as string, p as NotificationActor);
    }
  }

  return rows.map((r) => {
    const ids = r.actor_ids ?? [];
    const primary = r.actor_id ? actors.get(r.actor_id) ?? null : null;
    const extra = ids
      .filter((id) => id !== r.actor_id)
      .map((id) => actors.get(id))
      .filter(Boolean) as NotificationActor[];
    return {
      ...r,
      actor_ids: ids,
      actor: primary,
      extra_actors: extra,
    };
  });
}
