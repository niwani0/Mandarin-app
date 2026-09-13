export type ItemType = "pattern" | "character";

export type PatternMethod =
  | "audio_first"
  | "context_story"
  | "production_recall"
  | "flashcard_standard";

export type CharacterMethod = "radical_decomposition" | "flashcard_standard" | "mnemonic_story";

export type TeachingMethod = PatternMethod | CharacterMethod;

export const METHODS_BY_TYPE: Record<ItemType, TeachingMethod[]> = {
  pattern: ["audio_first", "context_story", "production_recall", "flashcard_standard"],
  character: ["radical_decomposition", "flashcard_standard", "mnemonic_story"],
};

/** A sentence-pattern template, e.g. "我要 ___" (I want ___). */
export interface PatternItem {
  id: string;
  scenarioId: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  /** Short context sentence showing the pattern used in a real exchange. */
  contextExample: string;
  contextExampleTranslation: string;
  /** What structural slot this pattern teaches, e.g. "existence question: 有没有 + noun". */
  structureNote: string;
}

export interface RadicalRef {
  radical: string;
  /** Standard Kangxi radical meaning — not folk etymology. */
  meaning: string;
  pinyin?: string;
}

export interface CharacterItem {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  radicals: RadicalRef[];
  /** A memory aid — explicitly a mnemonic, not a claim about true etymology. */
  mnemonicNote: string;
  /** Other characters in this content set that share a radical, for pattern reinforcement. */
  sharesRadicalWith?: string[];
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
}
