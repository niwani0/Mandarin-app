import type { SQLiteDatabase } from "expo-sqlite";

export interface ReviewState {
  item_id: string;
  repetitions: number;
  due_at: string;
}

const LEARNED_REPETITIONS_THRESHOLD = 2;

export async function getReviewStates(db: SQLiteDatabase, itemIds: string[]): Promise<Map<string, ReviewState>> {
  if (itemIds.length === 0) return new Map();
  const placeholders = itemIds.map(() => "?").join(",");
  const rows = await db.getAllAsync<ReviewState>(
    `SELECT item_id, repetitions, due_at FROM reviews WHERE item_id IN (${placeholders})`,
    itemIds,
  );
  return new Map(rows.map((r) => [r.item_id, r]));
}

/** Fraction of the given items the user has demonstrated durable recall on (competence, not streaks). */
export function computeCompetence(reviewStates: Map<string, ReviewState>, itemIds: string[]): number {
  if (itemIds.length === 0) return 0;
  const learned = itemIds.filter(
    (id) => (reviewStates.get(id)?.repetitions ?? 0) >= LEARNED_REPETITIONS_THRESHOLD,
  ).length;
  return learned / itemIds.length;
}

/** Competence broken down by frequency tier — how "patchy" mastery gets detected. */
export function computeTierCompetence(
  reviewStates: Map<string, ReviewState>,
  items: { id: string; tier: number }[],
): Record<1 | 2 | 3, number> {
  const byTier: Record<1 | 2 | 3, string[]> = { 1: [], 2: [], 3: [] };
  for (const item of items) byTier[item.tier as 1 | 2 | 3]?.push(item.id);
  return {
    1: computeCompetence(reviewStates, byTier[1]),
    2: computeCompetence(reviewStates, byTier[2]),
    3: computeCompetence(reviewStates, byTier[3]),
  };
}

export function countDue(reviewStates: Map<string, ReviewState>, itemIds: string[]): number {
  const now = Date.now();
  return itemIds.filter((id) => {
    const state = reviewStates.get(id);
    if (!state) return true; // never reviewed = due now
    return new Date(state.due_at).getTime() <= now;
  }).length;
}

/**
 * Due-for-review items first (oldest due first), then brand-new items to fill out the
 * session. Brand-new items are ordered by tier (tier 1 = simplest/most essential first)
 * rather than array order, so a gap in basic vocabulary surfaces before rarer material —
 * this is what makes "patchy" mastery (solid on some advanced patterns, shaky on simple
 * ones) get corrected instead of buried.
 */
export async function buildSessionQueue(
  db: SQLiteDatabase,
  itemIds: string[],
  sessionSize: number,
  tierById: Map<string, number>,
): Promise<string[]> {
  const reviewStates = await getReviewStates(db, itemIds);
  const now = Date.now();

  const overdue = itemIds
    .filter((id) => reviewStates.has(id) && new Date(reviewStates.get(id)!.due_at).getTime() <= now)
    .sort((a, b) => new Date(reviewStates.get(a)!.due_at).getTime() - new Date(reviewStates.get(b)!.due_at).getTime());

  const brandNew = itemIds
    .filter((id) => !reviewStates.has(id))
    .sort((a, b) => (tierById.get(a) ?? 3) - (tierById.get(b) ?? 3));

  return [...overdue, ...brandNew].slice(0, sessionSize);
}

/**
 * Seeds a review row as if the item were already learned (used by the calibration flow
 * when the user says "I already know this"), or leaves it untouched as a genuine new item
 * otherwise — untouched items surface via the tier-priority ordering above.
 */
export async function markCalibrated(
  db: SQLiteDatabase,
  itemId: string,
  itemType: string,
  alreadyKnown: boolean,
): Promise<void> {
  if (!alreadyKnown) return;
  const dueAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  await db.runAsync(
    `INSERT INTO reviews (item_id, item_type, ease_factor, interval_days, repetitions, due_at, updated_at)
     VALUES (?, ?, 2.5, 10, 2, ?, datetime('now'))
     ON CONFLICT(item_id) DO UPDATE SET
       repetitions = MAX(reviews.repetitions, 2),
       interval_days = MAX(reviews.interval_days, 10),
       due_at = ?,
       updated_at = datetime('now')`,
    [itemId, itemType, dueAt, dueAt],
  );
}

export async function logAttempt(
  db: SQLiteDatabase,
  itemId: string,
  itemType: string,
  method: string,
  correct: boolean,
  latencyMs: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO attempts (item_id, item_type, method, correct, latency_ms) VALUES (?, ?, ?, ?, ?)`,
    [itemId, itemType, method, correct ? 1 : 0, latencyMs],
  );
}
