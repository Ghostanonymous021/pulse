/**
 * Re-exports post-process eligibility + multipliers.
 * Implementation lives next to base score for a single pure module;
 * this file keeps the architectural split visible at import sites.
 */
export {
  applyScoreModifiers,
  filterEligibleCandidates,
  highlightMultiplier,
  shadowMultiplier,
  type EligibilityAuthor,
  type EligibilityViewer,
  type ModifierInput,
} from "./score";
