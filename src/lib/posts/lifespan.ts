/**
 * "Tempo de vida" — opcao discreta na composicao de publicacoes.
 * Sem categorias novas: e apenas expires_at (nullable) em posts.
 * Ver PULSE_VISAO_PRODUTO §Tempo de vida / §Expiracao.
 */

export type LifespanPreset = "permanent" | "24h" | "3d" | "7d" | "custom";

export const LIFESPAN_LABELS: Record<LifespanPreset, string> = {
  permanent: "Permanente",
  "24h": "24 horas",
  "3d": "3 dias",
  "7d": "7 dias",
  custom: "Personalizado",
};

const PRESET_MS: Record<Exclude<LifespanPreset, "permanent" | "custom">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

/** Resolve a preset (or custom date) to an ISO string, or null = permanente. */
export function resolveExpiresAt(
  preset: LifespanPreset,
  customDate?: Date | null,
): string | null {
  if (preset === "permanent") return null;
  if (preset === "custom") {
    if (!customDate || Number.isNaN(customDate.getTime())) return null;
    return customDate.toISOString();
  }
  return new Date(Date.now() + PRESET_MS[preset]).toISOString();
}

/** Short label for a resolved expires_at, used in previews/badges. */
export function describeLifespan(preset: LifespanPreset, customDate?: Date | null): string {
  if (preset !== "custom") return LIFESPAN_LABELS[preset];
  if (!customDate) return LIFESPAN_LABELS.custom;
  return customDate.toLocaleString("pt-PT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
