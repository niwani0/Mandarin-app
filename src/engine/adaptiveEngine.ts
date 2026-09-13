import type { SQLiteDatabase } from "expo-sqlite";
import type { ItemType, TeachingMethod } from "@/types/content";
import { METHODS_BY_TYPE } from "@/types/content";

const EWMA_ALPHA = 0.25;

interface MethodStatsRow {
  item_type: string;
  method: string;
  attempts: number;
  correct: number;
  ewma_success: number;
  ewma_latency_ms: number;
}

async function getStatsForType(db: SQLiteDatabase, itemType: ItemType): Promise<MethodStatsRow[]> {
  const rows = await db.getAllAsync<MethodStatsRow>(
    `SELECT * FROM method_stats WHERE item_type = ?`,
    [itemType],
  );
  const methods = METHODS_BY_TYPE[itemType];
  const byMethod = new Map(rows.map((r) => [r.method, r]));
  return methods.map(
    (method) =>
      byMethod.get(method) ?? {
        item_type: itemType,
        method,
        attempts: 0,
        correct: 0,
        ewma_success: 0.5,
        ewma_latency_ms: 4000,
      },
  );
}

/**
 * Picks the next teaching method for this item type using a UCB1-style bandit:
 * score = ewma_success + exploration_bonus, where the bonus shrinks as a method
 * accumulates attempts. This lets the app try every method early on, then lean
 * toward whichever one is actually producing correct, fast recall for this user.
 */
export async function selectMethod(db: SQLiteDatabase, itemType: ItemType): Promise<TeachingMethod> {
  const stats = await getStatsForType(db, itemType);
  const totalAttempts = stats.reduce((sum, s) => sum + s.attempts, 0);

  // Force-try any method with zero attempts first so every method gets a fair baseline.
  const untried = stats.find((s) => s.attempts === 0);
  if (untried) return untried.method as TeachingMethod;

  let best = stats[0];
  let bestScore = -Infinity;
  for (const s of stats) {
    const explorationBonus = Math.sqrt((2 * Math.log(totalAttempts + 1)) / s.attempts);
    const score = s.ewma_success + explorationBonus;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best.method as TeachingMethod;
}

export async function recordMethodOutcome(
  db: SQLiteDatabase,
  itemType: ItemType,
  method: TeachingMethod,
  correct: boolean,
  latencyMs: number,
): Promise<void> {
  const existing = await db.getFirstAsync<MethodStatsRow>(
    `SELECT * FROM method_stats WHERE item_type = ? AND method = ?`,
    [itemType, method],
  );

  if (!existing) {
    await db.runAsync(
      `INSERT INTO method_stats (item_type, method, attempts, correct, ewma_success, ewma_latency_ms, updated_at)
       VALUES (?, ?, 1, ?, ?, ?, datetime('now'))`,
      [itemType, method, correct ? 1 : 0, correct ? 1 : 0, latencyMs],
    );
    return;
  }

  const newEwmaSuccess = EWMA_ALPHA * (correct ? 1 : 0) + (1 - EWMA_ALPHA) * existing.ewma_success;
  const newEwmaLatency = EWMA_ALPHA * latencyMs + (1 - EWMA_ALPHA) * existing.ewma_latency_ms;

  await db.runAsync(
    `UPDATE method_stats
     SET attempts = attempts + 1,
         correct = correct + ?,
         ewma_success = ?,
         ewma_latency_ms = ?,
         updated_at = datetime('now')
     WHERE item_type = ? AND method = ?`,
    [correct ? 1 : 0, newEwmaSuccess, newEwmaLatency, itemType, method],
  );
}

export async function getMethodConfidence(
  db: SQLiteDatabase,
  itemType: ItemType,
  method: TeachingMethod,
): Promise<number> {
  const row = await db.getFirstAsync<MethodStatsRow>(
    `SELECT * FROM method_stats WHERE item_type = ? AND method = ?`,
    [itemType, method],
  );
  return row?.ewma_success ?? 0.5;
}

/** For the dashboard: which method is currently winning for this item type, and by how much confidence. */
export async function getBestMethod(
  db: SQLiteDatabase,
  itemType: ItemType,
): Promise<{ method: TeachingMethod; ewmaSuccess: number; attempts: number } | null> {
  const stats = await getStatsForType(db, itemType);
  const tried = stats.filter((s) => s.attempts >= 3);
  if (tried.length === 0) return null;
  const best = tried.reduce((a, b) => (b.ewma_success > a.ewma_success ? b : a));
  return { method: best.method as TeachingMethod, ewmaSuccess: best.ewma_success, attempts: best.attempts };
}
