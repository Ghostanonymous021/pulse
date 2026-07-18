import type { SupabaseClient } from "@supabase/supabase-js";

import type { AffinitySignals } from "@/lib/ranking/types";

export type ViewerContext = {
  id: string;
  campus: string | null;
  course: string | null;
  university: string | null;
};

export type AuthorMeta = {
  id: string;
  campus: string | null;
  course: string | null;
  university: string | null;
  is_private: boolean;
  habitual_reach: number;
  open_reports: number;
};

/**
 * Batch-load ranking signals for a set of authors (viewer-centric).
 */
export async function loadViewerContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<ViewerContext | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, campus, course, university")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return data as ViewerContext;
}

export async function loadAuthorMetas(
  supabase: SupabaseClient,
  authorIds: string[],
  reachWindow: number,
  reachFloor: number,
): Promise<Map<string, AuthorMeta>> {
  const map = new Map<string, AuthorMeta>();
  const unique = [...new Set(authorIds)];
  if (!unique.length) return map;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, campus, course, university, is_private")
    .in("id", unique);

  // Habitual reach proxy: avg (likes+comments) on last N posts, or profile_stats
  const { data: stats } = await supabase
    .from("profile_stats")
    .select("profile_id, post_reach")
    .in("profile_id", unique);

  const statsMap = new Map(
    (stats ?? []).map((s) => [
      s.profile_id as string,
      Number(s.post_reach ?? 0),
    ]),
  );

  // Recent posts engagement averages
  const reachFromPosts = await estimateHabitualReach(
    supabase,
    unique,
    reachWindow,
    reachFloor,
  );

  for (const p of profiles ?? []) {
    const id = p.id as string;
    const fromStats = statsMap.get(id) ?? 0;
    const fromPosts = reachFromPosts.get(id) ?? reachFloor;
    // Prefer post-window average; fall back to stats-derived; floor
    const habitual = Math.max(reachFloor, fromPosts || fromStats || reachFloor);
    map.set(id, {
      id,
      campus: (p.campus as string | null) ?? null,
      course: (p.course as string | null) ?? null,
      university: (p.university as string | null) ?? null,
      is_private: Boolean(p.is_private),
      habitual_reach: habitual,
      open_reports: 0,
    });
  }

  // Shadow-limit: open reports against profile
  const { data: reports } = await supabase
    .from("reports")
    .select("target_id")
    .eq("target_type", "profile")
    .eq("status", "open")
    .in("target_id", unique);

  const reportCounts = new Map<string, number>();
  for (const r of reports ?? []) {
    const id = r.target_id as string;
    reportCounts.set(id, (reportCounts.get(id) ?? 0) + 1);
  }
  for (const [id, meta] of map) {
    meta.open_reports = reportCounts.get(id) ?? 0;
  }

  return map;
}

async function estimateHabitualReach(
  supabase: SupabaseClient,
  authorIds: string[],
  window: number,
  floor: number,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  // Load recent posts per author (bounded)
  const { data: posts } = await supabase
    .from("posts")
    .select("id, author_id, likes(count), comments(count)")
    .in("author_id", authorIds)
    .order("created_at", { ascending: false })
    .limit(Math.min(500, authorIds.length * window));

  const buckets = new Map<string, number[]>();
  for (const p of posts ?? []) {
    const aid = p.author_id as string;
    const likes = aggCount(p.likes);
    const comments = aggCount(p.comments);
    const eng = likes + comments;
    const arr = buckets.get(aid) ?? [];
    if (arr.length < window) {
      arr.push(eng);
      buckets.set(aid, arr);
    }
  }

  for (const [aid, arr] of buckets) {
    if (!arr.length) {
      out.set(aid, floor);
      continue;
    }
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    out.set(aid, Math.max(floor, avg));
  }
  return out;
}

function aggCount(rel: unknown): number {
  if (rel == null) return 0;
  if (Array.isArray(rel)) {
    if (!rel.length) return 0;
    const f = rel[0] as { count?: number };
    if (typeof f?.count === "number") return f.count;
    return rel.length;
  }
  if (typeof rel === "object" && "count" in (rel as object)) {
    return Number((rel as { count: number }).count) || 0;
  }
  return 0;
}

export async function loadAffinityMap(
  supabase: SupabaseClient,
  viewer: ViewerContext,
  authorIds: string[],
  authorMetas: Map<string, AuthorMeta>,
): Promise<Map<string, AffinitySignals>> {
  const map = new Map<string, AffinitySignals>();
  const unique = [...new Set(authorIds)].filter((id) => id !== viewer.id);
  for (const id of unique) {
    const meta = authorMetas.get(id);
    map.set(id, {
      following: false,
      followed_by: false,
      same_campus: Boolean(
        viewer.campus &&
          meta?.campus &&
          viewer.campus.toLowerCase() === meta.campus.toLowerCase(),
      ),
      same_course: Boolean(
        viewer.course &&
          meta?.course &&
          viewer.course.toLowerCase() === meta.course.toLowerCase(),
      ),
      same_university: Boolean(
        viewer.university &&
          meta?.university &&
          viewer.university.toLowerCase() === meta.university.toLowerCase(),
      ),
      likes_on_author: 0,
      comments_on_author: 0,
      messages_with_author: 0,
      profile_visits: 0,
    });
  }
  // Self
  map.set(viewer.id, {
    following: false,
    followed_by: false,
    same_campus: true,
    same_course: true,
    same_university: true,
    likes_on_author: 0,
    comments_on_author: 0,
    messages_with_author: 0,
    profile_visits: 0,
  });

  if (!unique.length) return map;

  // Follows both directions
  const { data: outFollows } = await supabase
    .from("follows")
    .select("following_id, status")
    .eq("follower_id", viewer.id)
    .in("following_id", unique)
    .eq("status", "accepted");

  for (const f of outFollows ?? []) {
    const s = map.get(f.following_id as string);
    if (s) s.following = true;
  }

  const { data: inFollows } = await supabase
    .from("follows")
    .select("follower_id, status")
    .eq("following_id", viewer.id)
    .in("follower_id", unique)
    .eq("status", "accepted");

  for (const f of inFollows ?? []) {
    const s = map.get(f.follower_id as string);
    if (s) s.followed_by = true;
  }

  // Likes by viewer on authors' posts (sample via recent posts of those authors)
  const { data: authorPosts } = await supabase
    .from("posts")
    .select("id, author_id")
    .in("author_id", unique)
    .order("created_at", { ascending: false })
    .limit(Math.min(400, unique.length * 15));

  const postToAuthor = new Map<string, string>();
  for (const p of authorPosts ?? []) {
    postToAuthor.set(p.id as string, p.author_id as string);
  }
  const postIds = [...postToAuthor.keys()];
  if (postIds.length) {
    const { data: myLikes } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", viewer.id)
      .in("post_id", postIds);

    for (const l of myLikes ?? []) {
      const aid = postToAuthor.get(l.post_id as string);
      if (!aid) continue;
      const s = map.get(aid);
      if (s) s.likes_on_author += 1;
    }

    const { data: myComments } = await supabase
      .from("comments")
      .select("post_id")
      .eq("author_id", viewer.id)
      .in("post_id", postIds);

    for (const c of myComments ?? []) {
      const aid = postToAuthor.get(c.post_id as string);
      if (!aid) continue;
      const s = map.get(aid);
      if (s) s.comments_on_author += 1;
    }
  }

  // DM presence (conversation with peer)
  // Lightweight: messages sent by viewer in shared conversations is expensive;
  // approximate via conversation_participants pairs.
  const { data: myConvs } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", viewer.id);

  const convIds = (myConvs ?? []).map((c) => c.conversation_id as string);
  if (convIds.length) {
    const { data: peers } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds)
      .in("user_id", unique);

    for (const p of peers ?? []) {
      const s = map.get(p.user_id as string);
      if (s) s.messages_with_author = Math.max(s.messages_with_author, 1);
    }
  }

  return map;
}
