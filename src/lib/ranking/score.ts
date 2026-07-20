/**
 * Pure ranking (PULSE_VISAO_PRODUTO.md §15 + adenda).
 *
 * Base = A×wa + F×wf + E×we   ← no account type, no verified
 *
 * Eligibility (private) and multipliers (highlight, shadow) live in
 * filterEligibleCandidates / applyScoreModifiers — separate post-process.
 *
 * NEVER uses is_verified.
 */

import type {
  AffinitySignals,
  AffinityWeights,
  PostRankInput,
  RankingWeights,
  ScoreBreakdown,
} from "./types";

// ─── Affinity / Frescor / Engajamento (base only) ─────────────────────────

export function computeAffinity(
  signals: AffinitySignals,
  w: AffinityWeights,
): number {
  let base = w.none;
  if (signals.following && signals.followed_by) {
    base = w.mutual_follow;
  } else if (signals.following) {
    base = w.following;
  } else if (signals.same_campus) {
    base = w.same_campus;
  } else if (signals.same_course) {
    base = w.same_course;
  } else if (signals.same_university) {
    base = w.same_university;
  }

  const interaction =
    signals.likes_on_author * w.w_like +
    signals.comments_on_author * w.w_comment +
    signals.messages_with_author * w.w_message +
    signals.profile_visits * w.w_profile_visit;

  const bonus = Math.min(w.interaction_cap, interaction);
  return clamp01(base + bonus);
}

export function computeFreshness(
  createdAt: string | Date,
  isHighlighted: boolean,
  weights: Pick<
    RankingWeights,
    "meia_vida_horas" | "meia_vida_destaque_horas"
  >,
  now: Date = new Date(),
): number {
  const created =
    createdAt instanceof Date ? createdAt : new Date(createdAt);
  const hours = Math.max(
    0,
    (now.getTime() - created.getTime()) / (1000 * 60 * 60),
  );
  const halfLife = isHighlighted
    ? weights.meia_vida_destaque_horas
    : weights.meia_vida_horas;
  if (halfLife <= 0) return 1;
  return Math.pow(0.5, hours / halfLife);
}

export function computeEngagement(
  likeCount: number,
  commentCount: number,
  authorHabitualReach: number,
  weights: Pick<RankingWeights, "comentario_peso" | "alcance_minimo">,
): number {
  const raw =
    Math.max(0, likeCount) +
    Math.max(0, commentCount) * weights.comentario_peso;
  const reach = Math.max(weights.alcance_minimo, authorHabitualReach || 0);
  const ratio = raw / reach;
  return clamp01(Math.log1p(ratio) / Math.log1p(8));
}

/** Base only — no highlight/shadow/account-type. */
export function computeBaseScore(
  input: PostRankInput,
  weights: RankingWeights,
): Pick<ScoreBreakdown, "affinity" | "freshness" | "engagement" | "base"> {
  const now = input.now ?? new Date();
  const affinity = computeAffinity(input.affinity, weights.affinity);
  const freshness = computeFreshness(
    input.created_at,
    input.is_highlighted,
    weights,
    now,
  );
  const engagement = computeEngagement(
    input.like_count,
    input.comment_count,
    input.author_habitual_reach,
    weights,
  );

  const wa = weights.peso_afinidade;
  let wf = weights.peso_frescor;
  const we = weights.peso_engajamento;

  const hours =
    (now.getTime() -
      (input.created_at instanceof Date
        ? input.created_at
        : new Date(input.created_at)
      ).getTime()) /
    (1000 * 60 * 60);
  if (
    input.like_count === 0 &&
    input.comment_count === 0 &&
    hours < weights.frescor_boost_horas_sem_engajamento
  ) {
    wf *= 1.6;
  }

  const base = affinity * wa + freshness * wf + engagement * we;
  return { affinity, freshness, engagement, base };
}

// ─── Eligibility + multipliers (post-process, separate from base) ──────────

export type EligibilityAuthor = {
  id: string;
  is_private: boolean;
};

export type EligibilityViewer = {
  id: string;
  followingAuthorIds: Set<string>;
};

export type ModifierInput = {
  baseScore: number;
  is_highlighted: boolean;
  author_open_reports: number;
};

/** PRE-score filter: private → only approved followers (+ self). */
export function filterEligibleCandidates<
  T extends { author_id: string },
>(
  candidates: T[],
  authors: Map<string, EligibilityAuthor>,
  viewer: EligibilityViewer,
): T[] {
  return candidates.filter((c) => {
    if (c.author_id === viewer.id) return true;
    const meta = authors.get(c.author_id);
    if (!meta) return true;
    if (!meta.is_private) return true;
    return viewer.followingAuthorIds.has(c.author_id);
  });
}

/** Highlight: post flag only; same teto for org and verified-org. */
export function highlightMultiplier(
  isHighlighted: boolean,
  teto: number,
): number {
  if (!isHighlighted) return 1;
  const cap = Math.max(1, teto);
  return Math.min(cap, teto);
}

export function shadowMultiplier(
  openReports: number,
  threshold: number,
  factor: number,
): number {
  if (openReports < threshold) return 1;
  if (!Number.isFinite(factor)) return 1;
  return Math.min(1, Math.max(0, factor));
}

/** POST-score: highlight + shadow only. No recompute of A/F/E. */
export function applyScoreModifiers(
  input: ModifierInput,
  weights: Pick<
    RankingWeights,
    | "multiplicador_destaque_teto"
    | "shadow_report_threshold"
    | "shadow_limit_factor"
  >,
): Pick<
  ScoreBreakdown,
  "highlight_multiplier" | "shadow_multiplier" | "base" | "score"
> {
  const highlight_multiplier = highlightMultiplier(
    input.is_highlighted,
    weights.multiplicador_destaque_teto,
  );
  const shadow_multiplier = shadowMultiplier(
    input.author_open_reports,
    weights.shadow_report_threshold,
    weights.shadow_limit_factor,
  );
  const base = input.baseScore;
  const score = base * highlight_multiplier * shadow_multiplier;
  return { highlight_multiplier, shadow_multiplier, base, score };
}

export function computePostScore(
  input: PostRankInput,
  weights: RankingWeights,
): ScoreBreakdown {
  const core = computeBaseScore(input, weights);
  const mod = applyScoreModifiers(
    {
      baseScore: core.base,
      is_highlighted: input.is_highlighted,
      author_open_reports: input.author_open_reports,
    },
    weights,
  );
  return {
    ...core,
    highlight_multiplier: mod.highlight_multiplier,
    shadow_multiplier: mod.shadow_multiplier,
    base: mod.base,
    score: mod.score,
  };
}

export const computeHighlightMultiplier = highlightMultiplier;
export const computeShadowMultiplier = shadowMultiplier;

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
