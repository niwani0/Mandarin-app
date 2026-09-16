import type { PatternItem, Scenario } from "@/types/content";
import type { ReviewState } from "@/db/repository";

/**
 * Builds the system prompt for a scenario's AI roleplay partner. This is the actual
 * "AI tailoring": it hands the model what the learner has already practiced and where
 * they're shaky, so the conversation leans on known material and stretches gently
 * rather than firehosing unfamiliar vocabulary.
 */
export function buildConversationSystemPrompt(
  scenario: Scenario,
  patterns: PatternItem[],
  reviewStates: Map<string, ReviewState>,
): string {
  const solid = patterns.filter((p) => (reviewStates.get(p.id)?.repetitions ?? 0) >= 2);
  const shaky = patterns.filter((p) => (reviewStates.get(p.id)?.repetitions ?? 0) < 2);

  const solidList = solid.length
    ? solid.map((p) => `${p.hanzi} (${p.pinyin}) — ${p.meaning}`).join("; ")
    : "none yet — this is their first time in this scenario";
  const shakyList = shaky.length
    ? shaky.map((p) => `${p.hanzi} (${p.pinyin}) — ${p.meaning}`).join("; ")
    : "none — they've got everything in this scenario down";

  return [
    `You are roleplaying as a Mandarin-speaking local in a real "${scenario.title}" situation `,
    `in China (${scenario.description}). Stay in character.`,
    ``,
    `Rules:`,
    `- Speak only in natural, everyday Mandarin. After each Chinese sentence, put pinyin in `,
    `  parentheses. On a new line, add "EN: " followed by a short English translation of your `,
    `  line — the app hides this behind a tap-to-reveal, so it's safe to always include it.`,
    `- Keep each message short — one or two sentences, like real spoken exchange, not a `,
    `  paragraph.`,
    `- The learner is already solid on: ${solidList}.`,
    `- The learner is still shaky on: ${shakyList}. Lean on the material they're solid on; `,
    `  it's fine to use a shaky item once in a while so they get practice recalling it in `,
    `  context, but don't pile on unfamiliar vocabulary.`,
    `- If the learner's Mandarin has a clear grammar or word-choice error, briefly note the `,
    `  correction in one short English clause at the very end of your message, prefixed with `,
    `  "Note: ". Otherwise omit the Note line entirely. Never switch the main dialogue line `,
    `  itself into English.`,
    `- Open the conversation yourself, in character, with a natural first line for this `,
    `  situation.`,
  ].join("\n");
}
