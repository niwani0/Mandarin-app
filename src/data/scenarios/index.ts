import type { PatternItem, Scenario } from "@/types/content";
import { orderingFoodPatterns, orderingFoodScenario } from "./orderingFood";
import { hotelPatterns, hotelScenario } from "./hotel";
import { transportationPatterns, transportationScenario } from "./transportation";
import { smallTalkPatterns, smallTalkScenario } from "./smallTalk";

export const scenarios: Scenario[] = [orderingFoodScenario, hotelScenario, transportationScenario, smallTalkScenario];

export const allPatterns: PatternItem[] = [
  ...orderingFoodPatterns,
  ...hotelPatterns,
  ...transportationPatterns,
  ...smallTalkPatterns,
];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}

export function getPatternsForScenario(scenarioId: string): PatternItem[] {
  return allPatterns.filter((p) => p.scenarioId === scenarioId);
}
