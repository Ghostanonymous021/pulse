import type { SupabaseClient } from "@supabase/supabase-js";

import type { PostFollowState } from "@/components/feed/post-follow-icon";
import type { PostWithAuthor } from "@/components/feed/post-card";
import { loadLinkPreviewsForPosts } from "@/lib/links/preview";
import { signedMediaUrls } from "@/lib/posts/media";
import { getRankingWeights } from "@/lib/ranking/config";
import {
  loadAffinityMap,
  loadAuthorMetas,
  loadViewerContext,
} from "@/lib/ranking/load-signals";
import { rankFeedCandidates } from "@/lib/ranking/rank-feed";
import { FEED_PAGE_SIZE, type FeedScope } from "@/lib/posts/feed-constants";

// Re-exported for server call sites so this stays the single source of
// truth. Client components must import these from `feed-constants` directly
// (never from here) — see feed-constants.ts for why.
export { FEED_PAGE_SIZE, type FeedScope };

type RawPost = {
  id: string;
  author_id: string;
  body: string | null;
  is_highlighted: boolean;
  highlighted_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  author: PostWithAuthor["author"] | PostWithAuthor["author"][] | null;
  post_media?: {
    id: string;
    storage_path: string;
    position: number;
  }[];
  likes?: { count: number }[] | { user_id: string }[];
  comments?: { count: number }[] | { id: string }[];
};

function oneAuthor(author: RawPost["author"]): PostWithAuthor["author"] {
  if (!author) return null;
  return Array.isArray(author) ? (author[0] ?? null) : author;
}

function aggregateCount(rel: unknown): number {
  if (rel == null) return 0;
  if (Array.isArray(rel)) {
    if (!rel.length) return 0;
    const first = rel[0] as { count?: number };
    if (typeof first?.count === "number") return first.count;
    return rel.length;
  }
  if (typeof rel === "object" && "count" in (rel as object)) {
    return Number((rel as { count: number }).count) || 0;
  }
  return 0;
}

async function loadFollowMap(
  supabase: SupabaseClient,
  viewerId: string,
  authorIds: string[],
): Promise<Map<string, PostFollowState>> {
  const map = new Map<string, PostFollowState>();
  const unique = [...new Set(authorIds)];
  for (const id of unique) {
    if (id === viewerId) map.set(id, "self");
  }
  const others = unique.filter((id) => id !== viewerId);
  if (!others.length) return map;

  const { data } = await supabase
    .from("follows")
    .select("following_id, status")
    .eq("follower_id", viewerId)
    .in("following_id", others);

  for (const row of data ?? []) {
    const status =
      row.status === "pending" ? "pending" : ("accepted" as const);
    map.set(row.following_id as string, status);
  }

  for (const id of others) {
    if (!map.has(id)) map.set(id, "none");
  }
  return map;
}

async function mapPosts(
  supabase: SupabaseClient,
  userId: string,
  data: RawPost[],
): Promise<PostWithAuthor[]> {
  if (!data.length) return [];

  const postIds = data.map((r) => r.id);
  const authorIds = data.map((r) => r.author_id);

  const allPaths: string[] = [];
  for (const raw of data) {
    for (const m of raw.post_media ?? []) {
      if (m.storage_path) allPaths.push(m.storage_path);
    }
  }

  const [followMap, likedSet, previewMap, urlMap] = await Promise.all([
    loadFollowMap(supabase, userId, authorIds),
    (async () => {
      const set = new Set<string>();
      if (!postIds.length) return set;
      const { data: mine } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", postIds);
      for (const row of mine ?? []) set.add(row.post_id as string);
      return set;
    })(),
    loadLinkPreviewsForPosts(supabase, postIds),
    signedMediaUrls(supabase, allPaths),
  ]);

  return data.map((raw) => {
    const mediaRows = [...(raw.post_media ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const media = mediaRows.map((m) => ({
      id: m.id,
      storage_path: m.storage_path,
      position: m.position,
      url: urlMap.get(m.storage_path) ?? null,
    }));

    return {
      id: raw.id,
      author_id: raw.author_id,
      body: raw.body,
      is_highlighted: raw.is_highlighted,
      highlighted_at: raw.highlighted_at,
      expires_at: raw.expires_at,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      author: oneAuthor(raw.author),
      media,
      like_count: aggregateCount(raw.likes),
      comment_count: aggregateCount(raw.comments),
      liked_by_me: likedSet.has(raw.id),
      follow_state: followMap.get(raw.author_id) ?? "none",
      link_previews: previewMap.get(raw.id) ?? [],
    };
  });
}

// Aggregates only — never pull every like/comment row into the feed payload.
// NEVER select is_verified for ranking (Explore only).
const SELECT = `
  id,
  author_id,
  body,
  is_highlighted,
  highlighted_at,
  expires_at,
  created_at,
  updated_at,
  author:profiles!posts_author_id_fkey (
    id,
    username,
    display_name,
    avatar_url,
    account_type,
    is_private,
    is_verified,
    verified_type,
    verification_expires_at,
    campus,
    course,
    university
  ),
  post_media (
    id,
    storage_path,
    position
  ),
  likes ( count ),
  comments ( count )
`;

export type FeedPage = {
  posts: PostWithAuthor[];
  nextOffset: number | null;
};

export async function loadFeedPosts(
  supabase: SupabaseClient,
  userId: string,
  opts?: {
    authorId?: string;
    limit?: number;
    offset?: number;
    scope?: FeedScope;
  },
): Promise<PostWithAuthor[]> {
  const page = await loadFeedPage(supabase, userId, opts);
  return page.posts;
}

/**
 * Home feed: rank by affinity + freshness + normalized eng + highlight (§15).
 * Profile author feed: chronological (no global ranking).
 *
 * Private posts: filtered by RLS `can_view_post` — never leak to non-followers.
 * is_verified is NEVER used in score.
 */
export async function loadFeedPage(
  supabase: SupabaseClient,
  userId: string,
  opts?: {
    authorId?: string;
    limit?: number;
    offset?: number;
    scope?: FeedScope;
  },
): Promise<FeedPage> {
  const limit = opts?.limit ?? FEED_PAGE_SIZE;
  const offset = opts?.offset ?? 0;
  const scope = opts?.scope ?? "all";

  // Profile grid / author filter: keep simple chronology
  if (opts?.authorId) {
    return loadChronologicalPage(supabase, userId, {
      authorId: opts.authorId,
      limit,
      offset,
      scope,
    });
  }

  return loadRankedHomePage(supabase, userId, { limit, offset, scope });
}

async function loadChronologicalPage(
  supabase: SupabaseClient,
  userId: string,
  opts: {
    authorId?: string;
    limit: number;
    offset: number;
    scope: FeedScope;
  },
): Promise<FeedPage> {
  let query = supabase
    .from("posts")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (opts.authorId) {
    query = query.eq("author_id", opts.authorId);
  }

  // "Temporarias": so publicacoes com tempo de vida definido (ainda validas
  // -- as expiradas ja saem por RLS). "Todas" nao filtra por expires_at.
  if (opts.scope === "temporarias") {
    query = query.not("expires_at", "is", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("loadChronologicalPage", error.message, error.details);
    return { posts: [], nextOffset: null };
  }
  if (!data?.length) return { posts: [], nextOffset: null };

  const posts = await mapPosts(supabase, userId, data as unknown as RawPost[]);
  const nextOffset =
    data.length < opts.limit ? null : opts.offset + data.length;
  return { posts, nextOffset };
}

async function loadRankedHomePage(
  supabase: SupabaseClient,
  userId: string,
  opts: { limit: number; offset: number; scope: FeedScope },
): Promise<FeedPage> {
  const weights = getRankingWeights();
  const pool = Math.max(
    weights.candidate_pool_size,
    opts.offset + opts.limit + 30,
  );

  // Candidate pool: recent posts visible under RLS (private already gated).
  // Order by created_at only — ranking reorders by score, not verified.
  let poolQuery = supabase
    .from("posts")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(pool);

  if (opts.scope === "temporarias") {
    poolQuery = poolQuery.not("expires_at", "is", null);
  }

  const { data, error } = await poolQuery;

  if (error) {
    console.error("loadRankedHomePage", error.message, error.details);
    return { posts: [], nextOffset: null };
  }
  if (!data?.length) return { posts: [], nextOffset: null };

  const raw = data as unknown as RawPost[];
  const mapped = await mapPosts(supabase, userId, raw);
  const byId = new Map(mapped.map((p) => [p.id, p]));

  const authorIds = raw.map((r) => r.author_id);
  const viewer = await loadViewerContext(supabase, userId);
  if (!viewer) {
    // Fallback chronological
    const slice = mapped.slice(opts.offset, opts.offset + opts.limit);
    return {
      posts: slice,
      nextOffset:
        opts.offset + slice.length < mapped.length
          ? opts.offset + slice.length
          : null,
    };
  }

  const authorMetas = await loadAuthorMetas(
    supabase,
    authorIds,
    weights.alcance_posts_janela,
    weights.alcance_minimo,
  );
  const affinityByAuthor = await loadAffinityMap(
    supabase,
    viewer,
    authorIds,
    authorMetas,
  );

  const habitualReachByAuthor = new Map<string, number>();
  const openReportsByAuthor = new Map<string, number>();
  const authorPrivacy = new Map<
    string,
    { id: string; is_private: boolean }
  >();
  for (const [id, meta] of authorMetas) {
    habitualReachByAuthor.set(id, meta.habitual_reach);
    openReportsByAuthor.set(id, meta.open_reports);
    authorPrivacy.set(id, { id, is_private: meta.is_private });
  }

  const candidates = mapped.map((p) => ({
    id: p.id,
    author_id: p.author_id,
    created_at: p.created_at,
    is_highlighted: p.is_highlighted,
    like_count: p.like_count ?? 0,
    comment_count: p.comment_count ?? 0,
  }));

  // Eligibility (private) → base A/F/E → modifiers (highlight/shadow).
  // is_verified never enters this pipeline.
  const ranked = rankFeedCandidates(candidates, {
    viewerId: userId,
    affinityByAuthor,
    habitualReachByAuthor,
    openReportsByAuthor,
    authorPrivacy,
    weights,
  });

  const orderedIds = ranked.map((r) => r.item.id);
  const pageIds = orderedIds.slice(opts.offset, opts.offset + opts.limit);
  const posts = pageIds
    .map((id) => byId.get(id))
    .filter((p): p is PostWithAuthor => Boolean(p));

  const nextOffset =
    opts.offset + posts.length < orderedIds.length
      ? opts.offset + posts.length
      : null;

  return { posts, nextOffset };
}

export async function loadPostById(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
): Promise<PostWithAuthor | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(SELECT)
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    console.error("loadPostById", error.message, error.details);
    return null;
  }
  if (!data) return null;
  const [post] = await mapPosts(supabase, userId, [
    data as unknown as RawPost,
  ]);
  return post ?? null;
}
