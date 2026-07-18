/**
 * Orchestrates ranking for a candidate set (doc §15 + adenda tipo de conta).
 *
 * Pipeline:
 * 1. filterEligibleCandidates — private accounts (before score)
 * 2. computeBaseScore — A/F/E only (no account type)
 * 3. applyScoreModifiers — highlight + shadow (after base)
 * 4. sort + author spacing
 *
 * is_verified is NEVER used.
 */

import { getRankingWeights } from "@/lib/ranking/config";
import {
  applyScoreModifiers,
  filterEligibleCandidates,
  type EligibilityAuthor,
  type EligibilityViewer,
} from "@/lib/ranking/modifiers";
import { computeBaseScore } from "@/lib/ranking/score";
import { applyAuthorSpacing } from "@/lib/ranking/spacing";
import type {
  AffinitySignals,
  PostRankInput,
  RankedItem,
  RankingWeights,
  ScoreBreakdown,
} from "@/lib/ranking/types";

export type FeedCandidate = {
  id: string;
  author_id: string;
  created_at: string;
  is_highlighted: boolean;
  like_count: number;
  comment_count: number;
};

export type RankContext = {
  viewerId: string;
  affinityByAuthor: Map<string, AffinitySignals>;
  habitualReachByAuthor: Map<string, number>;
  openReportsByAuthor: Map<string, number>;
  /** is_private + id per author */
  authorPrivacy: Map<string, EligibilityAuthor>;
  weights?: RankingWeights;
  now?: Date;
};

/**
 * Score + sort + author spacing.
 * Eligibility filter runs first; modifiers after base score.
 */
export function rankFeedCandidates<T extends FeedCandidate>(
  candidates: T[],
  ctx: RankContext,
): RankedItem<T>[] {
  const weights = ctx.weights ?? getRankingWeights();
  const now = ctx.now ?? new Date();

  const followingAuthorIds = new Set<string>();
  for (const [authorId, sig] of ctx.affinityByAuthor) {
    if (sig.following) followingAuthorIds.add(authorId);
  }

  const viewer: EligibilityViewer = {
    id: ctx.viewerId,
    followingAuthorIds,
  };

  // 1) Eligibility BEFORE any score (private accounts)
  const eligible = filterEligibleCandidates(
    candidates,
    ctx.authorPrivacy,
    viewer,
  );

  // 2) Base score (no account-type multipliers)
  // 3) Post-process multipliers (highlight flag + shadow reports)
  const ranked: RankedItem<T>[] = eligible.map((c) => {
    const affinity =
      ctx.affinityByAuthor.get(c.author_id) ?? defaultAffinity();
    const input: PostRankInput = {
      id: c.id,
      author_id: c.author_id,
      created_at: c.created_at,
      is_highlighted: c.is_highlighted,
      like_count: c.like_count,
      comment_count: c.comment_count,
      author_habitual_reach:
        ctx.habitualReachByAuthor.get(c.author_id) ?? weights.alcance_minimo,
      author_open_reports: ctx.openReportsByAuthor.get(c.author_id) ?? 0,
      affinity,
      now,
    };

    const core = computeBaseScore(input, weights);
    const mod = applyScoreModifiers(
      {
        baseScore: core.base,
        is_highlighted: c.is_highlighted,
        author_open_reports: input.author_open_reports,
      },
      weights,
    );

    const breakdown: ScoreBreakdown = {
      affinity: core.affinity,
      freshness: core.freshness,
      engagement: core.engagement,
      highlight_multiplier: mod.highlight_multiplier,
      shadow_multiplier: mod.shadow_multiplier,
      base: mod.base,
      score: mod.score,
    };

    return {
      item: c,
      author_id: c.author_id,
      score: breakdown.score,
      breakdown,
    };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      new Date(b.item.created_at).getTime() -
      new Date(a.item.created_at).getTime()
    );
  });

  return applyAuthorSpacing(ranked);
}

function defaultAffinity(): AffinitySignals {
  return {
    following: false,
    followed_by: false,
    same_campus: false,
    same_course: false,
    same_university: false,
    likes_on_author: 0,
    comments_on_author: 0,
    messages_with_author: 0,
    profile_visits: 0,
  };
}
