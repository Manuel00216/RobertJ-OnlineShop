import { OCCASIONS } from "@/features/assistant/schemas/rule.schema";

/** Shared display labels for `recommendation_occasion` — admin/seller rule
 * authoring (`RecommendationRuleManager`/`RecommendationRuleRow`) and the
 * buyer-facing quiz (`GuidedSelectorQuiz`) both read from this one map. */
export const OCCASION_LABELS: Record<(typeof OCCASIONS)[number], string> = {
  casual: "Casual",
  formal: "Formal",
  work: "Work",
  sportswear: "Sportswear",
  party: "Party",
  wedding: "Wedding",
  everyday: "Everyday",
};
