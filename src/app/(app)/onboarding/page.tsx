import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { PEOPLE_SUGGESTIONS_PAGE_SIZE, loadPeopleSuggestions } from "@/lib/social/suggestions";
import { requireProfile } from "@/lib/auth/session";

export const metadata = {
  title: "Comecar",
};

/**
 * Professional multi-step onboarding after signup.
 * Entry: /onboarding — immersive (chrome none).
 *
 * O passo "Segue alguem" reutiliza o mesmo motor de ranking/paginacao
 * de Pessoas > Sugestoes (loadPeopleSuggestions) em vez de uma query
 * propria e estatica. Antes desta correcao, esta lista tinha 3
 * problemas visiveis: nunca actualizava/paginava (30 contas fixas,
 * sem "ver mais"), nao mostrava o selo de verificacao, e nao respeitava
 * o mesmo ranking (mutuos, campus/curso/universidade) que o resto do
 * produto usa — parecia outra funcionalidade, nao a mesma.
 */
export default async function OnboardingPage() {
  const { supabase, profile } = await requireProfile();

  const { suggestions, nextOffset } = await loadPeopleSuggestions(
    supabase,
    profile.id,
    profile,
    { limit: PEOPLE_SUGGESTIONS_PAGE_SIZE },
  );

  return (
    <OnboardingFlow
      profile={profile}
      initialSuggestions={suggestions}
      initialSuggestionsNextOffset={nextOffset}
    />
  );
}
