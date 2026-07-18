import rankingJson from "../../../config/ranking.json";

import type { RankingWeights } from "@/lib/ranking/types";

/**
 * Configurable ranking weights (doc §15.3).
 * Defaults from config/ranking.json; optional env overrides without redeploy of logic.
 *
 * Env (optional):
 *   RANKING_PESO_AFINIDADE, RANKING_PESO_FRESCOR, RANKING_PESO_ENGAJAMENTO
 *   RANKING_MEIA_VIDA_HORAS, RANKING_DESTAQUE_TETO, RANKING_SHADOW_FACTOR
 */
export function getRankingWeights(): RankingWeights {
  const base = rankingJson as RankingWeights;

  return {
    ...base,
    affinity: { ...base.affinity },
    peso_afinidade: numEnv("RANKING_PESO_AFINIDADE", base.peso_afinidade),
    peso_frescor: numEnv("RANKING_PESO_FRESCOR", base.peso_frescor),
    peso_engajamento: numEnv("RANKING_PESO_ENGAJAMENTO", base.peso_engajamento),
    meia_vida_horas: numEnv("RANKING_MEIA_VIDA_HORAS", base.meia_vida_horas),
    meia_vida_destaque_horas: numEnv(
      "RANKING_MEIA_VIDA_DESTAQUE_HORAS",
      base.meia_vida_destaque_horas,
    ),
    multiplicador_destaque_teto: numEnv(
      "RANKING_DESTAQUE_TETO",
      base.multiplicador_destaque_teto,
    ),
    shadow_limit_factor: numEnv(
      "RANKING_SHADOW_FACTOR",
      base.shadow_limit_factor,
    ),
    shadow_report_threshold: numEnv(
      "RANKING_SHADOW_THRESHOLD",
      base.shadow_report_threshold,
    ),
    candidate_pool_size: numEnv(
      "RANKING_CANDIDATE_POOL",
      base.candidate_pool_size,
    ),
  };
}

function numEnv(key: string, fallback: number): number {
  const raw =
    typeof process !== "undefined" ? process.env[key] : undefined;
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
