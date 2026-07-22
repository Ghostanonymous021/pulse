import type { SupabaseClient } from "@supabase/supabase-js";

import type { FollowUiState } from "@/components/social/follow-button";
import type { Profile } from "@/types/database";

export type PeopleSuggestion = Pick<
  Profile,
  | "id"
  | "username"
  | "display_name"
  | "avatar_url"
  | "university"
  | "campus"
  | "course"
  | "account_type"
  | "is_private"
  | "is_verified"
  | "verified_type"
  | "verification_expires_at"
> & {
  followState: FollowUiState;
  mutualCount: number;
  sameCampus: boolean;
};

const MAX_SUGGESTIONS = 40;

/**
 * "Pessoas que talvez conheças" (Facebook PYMK pattern, adapted):
 *
 * Facebook's real PYMK is a graph-traversal + ML ranking system (mutual
 * friends, uploaded contacts, shared groups/workplace, profile visits,
 * etc.) — far beyond what a single query should attempt. The signals
 * that translate cleanly to a university social app without needing a
 * ML pipeline or contact-upload consent flow are the two Facebook itself
 * leans on hardest for cold-start ranking:
 *
 *   1. Mutual connections — people the viewer already follows who also
 *      follow the candidate. This is *the* strongest PYMK signal in
 *      published descriptions of the feature (2nd-degree graph).
 *   2. Shared context — same university/campus/course, i.e. the offline
 *      network you'd actually recognize. Pulse already uses this exact
 *      signal in onboarding (see onboarding/page.tsx); this reuses it
 *      as a ranking booster rather than a hard filter.
 *
 * Both signals are combined (mutuals weighted higher, since a mutual
 * follow is a much stronger "you probably know this person" signal than
 * merely sharing a campus), already-followed / pending / blocked /
 * self accounts are excluded, and results degrade gracefully to
 * "recently joined" when the graph is too sparse (new users, small
 * network) — same fallback the onboarding flow already uses.
 */
export async function loadPeopleSuggestions(
  supabase: SupabaseClient,
  viewerId: string,
  viewerProfile: Pick<Profile, "university" | "campus" | "course">,
): Promise<PeopleSuggestion[]> {
  const [{ data: following }, { data: blockedRows }] = await Promise.all([
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewerId),
    supabase
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
  ]);

  const alreadyFollowingIds = new Set(
    (following ?? []).map((f) => f.following_id as string),
  );
  const excludeIds = new Set<string>([viewerId, ...alreadyFollowingIds]);
  for (const b of blockedRows ?? []) {
    excludeIds.add(b.blocker_id === viewerId ? b.blocked_id : b.blocker_id);
  }

  // Signal 1: mutual connections. People followed by accounts the
  // viewer follows ("friends of friends"), excluding people already
  // followed/blocked/self. This mirrors Facebook's core PYMK signal.
  const mutualCounts = new Map<string, number>();
  if (alreadyFollowingIds.size > 0) {
    const { data: fof } = await supabase
      .from("follows")
      .select("following_id")
      .in("follower_id", Array.from(alreadyFollowingIds))
      .eq("status", "accepted");
    for (const row of fof ?? []) {
      const id = row.following_id as string;
      if (excludeIds.has(id)) continue;
      mutualCounts.set(id, (mutualCounts.get(id) ?? 0) + 1);
    }
  }

  // Signal 2: shared context (same campus beats same university/course
  // as a "you'd probably recognize them" signal).
  let contextRows: Profile[] = [];
  if (viewerProfile.campus) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("campus", viewerProfile.campus)
      .neq("id", viewerId)
      .limit(100);
    contextRows = (data ?? []) as Profile[];
  } else if (viewerProfile.course) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("course", viewerProfile.course)
      .neq("id", viewerId)
      .limit(100);
    contextRows = (data ?? []) as Profile[];
  } else if (viewerProfile.university) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("university", viewerProfile.university)
      .neq("id", viewerId)
      .limit(100);
    contextRows = (data ?? []) as Profile[];
  }

  const candidateIds = new Set<string>([
    ...mutualCounts.keys(),
    ...contextRows.filter((r) => !excludeIds.has(r.id)).map((r) => r.id),
  ]);

  // Cold start: not enough graph/context signal — fall back to recent
  // joiners, same pattern onboarding already uses.
  if (candidateIds.size < 5) {
    const { data: recent } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", viewerId)
      .order("created_at", { ascending: false })
      .limit(MAX_SUGGESTIONS);
    for (const r of (recent ?? []) as Profile[]) {
      if (!excludeIds.has(r.id)) candidateIds.add(r.id);
    }
  }

  if (candidateIds.size === 0) return [];

  const idsToFetch = Array.from(candidateIds).slice(0, 200);
  const profileById = new Map<string, Profile>();
  for (const r of contextRows) profileById.set(r.id, r);

  const missingIds = idsToFetch.filter((id) => !profileById.has(id));
  if (missingIds.length) {
    const { data: fetched } = await supabase
      .from("profiles")
      .select("*")
      .in("id", missingIds);
    for (const r of (fetched ?? []) as Profile[]) profileById.set(r.id, r);
  }

  const { data: pendingRows } = await supabase
    .from("follows")
    .select("following_id, status")
    .eq("follower_id", viewerId)
    .in("following_id", idsToFetch);
  const pendingMap = new Map(
    (pendingRows ?? []).map((f) => [f.following_id as string, f.status as string]),
  );

  const contextIds = new Set(contextRows.map((r) => r.id));

  const ranked = idsToFetch
    .map((id) => profileById.get(id))
    .filter((p): p is Profile => Boolean(p))
    .map((p) => {
      const mutualCount = mutualCounts.get(p.id) ?? 0;
      const sameCampus =
        contextIds.has(p.id) && p.campus === viewerProfile.campus;
      const status = pendingMap.get(p.id);
      const followState: FollowUiState =
        status === "pending" ? "pending" : "none";
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        university: p.university,
        campus: p.campus,
        course: p.course,
        account_type: p.account_type,
        is_private: p.is_private,
        is_verified: p.is_verified,
        verified_type: p.verified_type,
        verification_expires_at: p.verification_expires_at,
        followState,
        mutualCount,
        sameCampus,
      } satisfies PeopleSuggestion;
    })
    .sort((a, b) => {
      // Mutuals dominate ranking (strongest "you probably know them"
      // signal); shared campus is a tiebreaker/secondary boost.
      const scoreA = a.mutualCount * 10 + (a.sameCampus ? 1 : 0);
      const scoreB = b.mutualCount * 10 + (b.sameCampus ? 1 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.display_name.localeCompare(b.display_name, "pt");
    })
    .slice(0, MAX_SUGGESTIONS);

  return ranked;
}
