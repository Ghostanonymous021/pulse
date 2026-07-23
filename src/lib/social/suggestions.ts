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

export type PeopleSuggestionsPage = {
  suggestions: PeopleSuggestion[];
  nextOffset: number | null;
};

/** First paint page size; also the /api/people/suggestions page size. */
export const PEOPLE_SUGGESTIONS_PAGE_SIZE = 20;

/**
 * Hard ceiling on how many non-excluded profiles we pull into the
 * ranking pass per request. Fine at campus-app scale (hundreds of
 * accounts) — at thousands+ this is the spot to swap for a proper
 * server-side ranked materialized view / cursor instead of ranking
 * the whole pool in memory on every page request.
 */
const CANDIDATE_POOL_CEILING = 3000;

/** Discovery accounts (no mutual/context signal) get one slot out of
 * every N in the final order, instead of being dumped after every
 * signal-having account — this is what actually makes "everyone gets
 * a shot at being seen" true rather than theoretical. */
const DISCOVERY_INTERLEAVE_EVERY = 4;

/**
 * Free-text campus/university/course fields have no canonical form
 * (users typed them at onboarding: accents, case, extra commas/spaces,
 * typos). Lowercases, strips accents/punctuation, and keeps only the
 * first comma-separated token ("chongoene, xaixai" -> "chongoene")
 * so a substring match actually lines up viewer and candidate rows
 * that mean the same place.
 */
function normalizeContextValue(value: string | null | undefined): string {
  if (!value) return "";
  const firstToken = value.split(",")[0] ?? value;
  return firstToken
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function contextMatches(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeContextValue(a);
  const nb = normalizeContextValue(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Stable per-candidate, per-day hash in [0, 1). Same (id, day) always
 * gives the same number — critical so ordering stays put across pages
 * of the same infinite-scroll session (otherwise you'd re-shuffle
 * mid-scroll and skip or repeat accounts) — but the day component
 * means the tiebreak, and therefore who surfaces near the top of the
 * "sem sinal ainda" tier, rotates day to day. FNV-1a: simple, fast,
 * good-enough distribution for a tiebreaker (not cryptographic).
 */
function dailyJitter(id: string, dayKey: string): number {
  const s = `${id}:${dayKey}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Round-robin merge that guarantees one `secondary` item every `every`
 * slots instead of appending it after `primary` runs out. */
function interleave<T>(primary: T[], secondary: T[], every: number): T[] {
  const result: T[] = [];
  let pi = 0;
  let si = 0;
  let slot = 0;
  while (pi < primary.length || si < secondary.length) {
    slot++;
    const takeSecondary = slot % every === 0 && si < secondary.length;
    if (takeSecondary) {
      result.push(secondary[si++]);
    } else if (pi < primary.length) {
      result.push(primary[pi++]);
    } else {
      result.push(secondary[si++]);
    }
  }
  return result;
}

type RankedCandidate = {
  profile: Profile;
  mutualCount: number;
  sameCampus: boolean;
  sameCourse: boolean;
  sameUniversity: boolean;
  hasSignal: boolean;
  jitter: number;
};

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
 *      network you'd actually recognize.
 *
 * On top of that, two things every big-app PYMK also does that a naive
 * "rank once, show top 40" implementation misses:
 *
 *   - Pagination over the FULL candidate pool (everyone not already
 *     followed/following/blocked/self), not a small fixed slice — so
 *     nobody in the network is permanently unreachable, only reachable
 *     by scrolling further. "Ver mais" / infinite scroll, not a cap.
 *   - Exposure fairness — accounts with no mutuals and no shared
 *     context ("discovery" tier) are interleaved into the order at a
 *     steady rate (see DISCOVERY_INTERLEAVE_EVERY) instead of being
 *     dumped after every higher-signal account, and their relative
 *     order rotates daily (dailyJitter) so it's not always the exact
 *     same strangers stuck at the back of that tier forever.
 *
 * already-followed / pending / blocked / self accounts are excluded.
 */
/**
 * Shared by loadPeopleSuggestions (pagination) and searchPeopleSuggestions
 * (search-as-you-type). Both need the exact same exclusion set (self /
 * already-following / already-follower / blocked, both directions) and
 * the same mutual-connection counts — computing them once here keeps the
 * two code paths from silently drifting apart (e.g. one excluding
 * followers and the other forgetting to).
 */
async function computeExclusionAndMutuals(
  supabase: SupabaseClient,
  viewerId: string,
): Promise<{ excludeIds: Set<string>; mutualCounts: Map<string, number> }> {
  const [{ data: following }, { data: followers }, { data: blockedRows }] =
    await Promise.all([
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", viewerId),
      // People who already follow the viewer are excluded from PYMK too —
      // they surface as "seguidores" already; suggesting them again here
      // as a stranger to discover is what actually looked like a bug
      // (e.g. someone who follows you showing up in both lists).
      supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", viewerId)
        .eq("status", "accepted"),
      supabase
        .from("blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
    ]);

  const alreadyFollowingIds = new Set(
    (following ?? []).map((f) => f.following_id as string),
  );
  const alreadyFollowerIds = new Set(
    (followers ?? []).map((f) => f.follower_id as string),
  );
  const excludeIds = new Set<string>([
    viewerId,
    ...alreadyFollowingIds,
    ...alreadyFollowerIds,
  ]);
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

  return { excludeIds, mutualCounts };
}

async function buildFollowStateMap(
  supabase: SupabaseClient,
  viewerId: string,
  candidateIds: string[],
): Promise<Map<string, FollowUiState>> {
  if (candidateIds.length === 0) return new Map();
  const { data: pendingRows } = await supabase
    .from("follows")
    .select("following_id, status")
    .eq("follower_id", viewerId)
    .in("following_id", candidateIds);
  return new Map(
    (pendingRows ?? []).map((f) => [
      f.following_id as string,
      (f.status as string) === "pending" ? "pending" : "none",
    ]),
  );
}

export async function loadPeopleSuggestions(
  supabase: SupabaseClient,
  viewerId: string,
  viewerProfile: Pick<Profile, "university" | "campus" | "course">,
  opts?: { limit?: number; offset?: number },
): Promise<PeopleSuggestionsPage> {
  const limit = opts?.limit ?? PEOPLE_SUGGESTIONS_PAGE_SIZE;
  const offset = opts?.offset ?? 0;

  const { excludeIds, mutualCounts } = await computeExclusionAndMutuals(
    supabase,
    viewerId,
  );

  // Full candidate pool: everyone not already excluded. This is what
  // makes every account in the network reachable — ranking below only
  // decides *order*, pagination (offset/limit) decides how much of it
  // is sent per request, never a hard visibility cap.
  const { data: poolRows, error: poolError } = await supabase
    .from("profiles")
    .select("*")
    .not(
      "id",
      "in",
      `(${Array.from(excludeIds).join(",") || "00000000-0000-0000-0000-000000000000"})`,
    )
    .limit(CANDIDATE_POOL_CEILING);

  if (poolError) {
    console.error("loadPeopleSuggestions", poolError.message);
    return { suggestions: [], nextOffset: null };
  }

  const dayKey = todayKey();
  const ranked: RankedCandidate[] = ((poolRows ?? []) as Profile[]).map(
    (profile) => {
      const mutualCount = mutualCounts.get(profile.id) ?? 0;
      const sameCampus = contextMatches(profile.campus, viewerProfile.campus);
      const sameCourse = contextMatches(profile.course, viewerProfile.course);
      const sameUniversity = contextMatches(
        profile.university,
        viewerProfile.university,
      );
      return {
        profile,
        mutualCount,
        sameCampus,
        sameCourse,
        sameUniversity,
        hasSignal:
          mutualCount > 0 || sameCampus || sameCourse || sameUniversity,
        jitter: dailyJitter(profile.id, dayKey),
      };
    },
  );

  function score(r: RankedCandidate): number {
    return (
      r.mutualCount * 10 +
      (r.sameCampus ? 3 : 0) +
      (r.sameCourse ? 2 : 0) +
      (r.sameUniversity ? 1 : 0)
    );
  }

  const signalTier = ranked
    .filter((r) => r.hasSignal)
    .sort((a, b) => {
      const scoreA = score(a);
      const scoreB = score(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      // Same score: rotate daily instead of always the same order.
      if (b.jitter !== a.jitter) return b.jitter - a.jitter;
      return a.profile.display_name.localeCompare(b.profile.display_name, "pt");
    });

  // Discovery tier: no mutual/context signal at all yet. Pure daily
  // rotating order — this is the "everyone gets a fair shot at being
  // seen" mechanism for accounts the graph doesn't vouch for yet.
  const discoveryTier = ranked
    .filter((r) => !r.hasSignal)
    .sort((a, b) => {
      if (b.jitter !== a.jitter) return b.jitter - a.jitter;
      return a.profile.display_name.localeCompare(b.profile.display_name, "pt");
    });

  const finalOrder = interleave(
    signalTier,
    discoveryTier,
    DISCOVERY_INTERLEAVE_EVERY,
  );

  const total = finalOrder.length;
  const pageSlice = finalOrder.slice(offset, offset + limit);
  const nextOffset = offset + pageSlice.length < total ? offset + pageSlice.length : null;

  if (pageSlice.length === 0) {
    return { suggestions: [], nextOffset: null };
  }

  const pageIds = pageSlice.map((r) => r.profile.id);
  const followStateMap = await buildFollowStateMap(supabase, viewerId, pageIds);

  const suggestions: PeopleSuggestion[] = pageSlice.map((r) => {
    const p = r.profile;
    const followState = followStateMap.get(p.id) ?? "none";
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
      mutualCount: r.mutualCount,
      sameCampus: r.sameCampus,
    } satisfies PeopleSuggestion;
  });

  return { suggestions, nextOffset };
}

/**
 * Search-as-you-type over the FULL network, scoped to the same
 * PeopleHub "Sugestões" tab — not just whatever pages of pagination
 * happen to be loaded client-side.
 *
 * Bug this fixes: PeopleHub's search box only ever filtered the
 * suggestions array already sitting in React state (see filterPeople()
 * in people-hub.tsx, pre-fix). Sugestões loads a full pool but pages it
 * in 20 at a time — a real account many pages deep (e.g. someone who
 * joined a few hours ago, position ~60 of 121 reachable candidates)
 * would search as "no results" simply because the viewer had not
 * scrolled that far yet, even though the account exists and is fully
 * reachable via Explorar's search_profiles RPC. "Pesquisei e não
 * aparece" was this, not a missing-data bug.
 *
 * Reuses search_profiles (supabase/migrations/20260722200100_search_
 * profiles_fn.sql) — the same pg_trgm-backed, typo-tolerant RPC
 * Explorar already relies on — instead of duplicating ranking logic.
 * Applies the exact same exclusion set as loadPeopleSuggestions (self /
 * following / followers / blocked) so a search never surfaces someone
 * who is already in Seguidores or A seguir as a "stranger to discover".
 */
export async function searchPeopleSuggestions(
  supabase: SupabaseClient,
  viewerId: string,
  query: string,
  limit = 40,
): Promise<PeopleSuggestion[]> {
  const q = query.trim();
  if (!q) return [];

  const [{ excludeIds, mutualCounts }, { data: matches, error }] =
    await Promise.all([
      computeExclusionAndMutuals(supabase, viewerId),
      supabase.rpc("search_profiles", { p_query: q, p_limit: limit * 3 }),
    ]);

  if (error) {
    console.error("searchPeopleSuggestions", error.message);
    return [];
  }

  const candidates = ((matches ?? []) as Profile[]).filter(
    (p) => !excludeIds.has(p.id),
  );
  if (candidates.length === 0) return [];

  const pageIds = candidates.slice(0, limit).map((p) => p.id);
  const followStateMap = await buildFollowStateMap(supabase, viewerId, pageIds);

  return candidates.slice(0, limit).map(
    (p) =>
      ({
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
        followState: followStateMap.get(p.id) ?? "none",
        mutualCount: mutualCounts.get(p.id) ?? 0,
        sameCampus: false,
      }) satisfies PeopleSuggestion,
  );
}
