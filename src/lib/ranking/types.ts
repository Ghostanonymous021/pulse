/** Ranking inputs/outputs — pure, no DB (doc §15). */

export type RankingWeights = {
  peso_afinidade: number;
  peso_frescor: number;
  peso_engajamento: number;
  meia_vida_horas: number;
  meia_vida_destaque_horas: number;
  multiplicador_destaque_teto: number;
  comentario_peso: number;
  alcance_posts_janela: number;
  alcance_minimo: number;
  shadow_report_threshold: number;
  shadow_limit_factor: number;
  frescor_boost_horas_sem_engajamento: number;
  candidate_pool_size: number;
  affinity: AffinityWeights;
};

export type AffinityWeights = {
  mutual_follow: number;
  following: number;
  same_campus: number;
  same_course: number;
  same_university: number;
  none: number;
  interaction_cap: number;
  w_like: number;
  w_comment: number;
  w_message: number;
  w_profile_visit: number;
};

export type AffinitySignals = {
  /** Viewer follows author (accepted) */
  following: boolean;
  /** Author follows viewer back (accepted) */
  followed_by: boolean;
  same_campus: boolean;
  same_course: boolean;
  same_university: boolean;
  /** Counts of prior interactions viewer → author */
  likes_on_author: number;
  comments_on_author: number;
  messages_with_author: number;
  profile_visits: number;
};

export type PostRankInput = {
  id: string;
  author_id: string;
  created_at: string | Date;
  is_highlighted: boolean;
  like_count: number;
  comment_count: number;
  /** Average habitual reach of author (impressions or engagement proxy) */
  author_habitual_reach: number;
  /** Open profile reports against author */
  author_open_reports: number;
  affinity: AffinitySignals;
  /** Now override for tests */
  now?: Date;
};

export type ScoreBreakdown = {
  affinity: number;
  freshness: number;
  engagement: number;
  highlight_multiplier: number;
  shadow_multiplier: number;
  base: number;
  score: number;
};

export type RankedItem<T> = {
  item: T;
  author_id: string;
  score: number;
  breakdown: ScoreBreakdown;
};
