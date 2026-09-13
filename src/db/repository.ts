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

export function countDue(reviewStates: Map<string, ReviewState>, itemIds: string[]): number {
  const now = Date.now();
  return itemIds.filter((id) => {
    const state = reviewStates.get(id);
    if (!state) return true; // never reviewed = due now
    return new Date(state.due_at).getTime() <= now;
  }).length;
}

/** Due-for-review items first (oldest due first), then brand-new items to fill out the session. */
export async function buildSessionQueue(
  db: SQLiteDatabase,
  itemIds: string[],
  sessionSize: number,
): Promise<string[]> {
  const reviewStates = await getReviewStates(db, itemIds);
  const now = Date.now();

  const overdue = itemIds
    .filter((id) => reviewStates.has(id) && new Date(reviewStates.get(id)!.due_at).getTime() <= now)
    .sort((a, b) => new Date(reviewStates.get(a)!.due_at).getTime() - new Date(reviewStates.get(b)!.due_at).getTime());

  const brandNew = itemIds.filter((id) => !reviewStates.has(id));

  return [...overdue, ...brandNew].slice(0, sessionSize);
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
