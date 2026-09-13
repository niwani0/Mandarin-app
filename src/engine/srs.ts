import type { SQLiteDatabase } from "expo-sqlite";
import type { ItemType, TeachingMethod } from "@/types/content";

interface ReviewRow {
  item_id: string;
  item_type: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
}

export async function getDueItemIds(db: SQLiteDatabase, itemType: ItemType, limit: number): Promise<string[]> {
  const rows = await db.getAllAsync<{ item_id: string }>(
    `SELECT item_id FROM reviews WHERE item_type = ? AND due_at <= datetime('now') ORDER BY due_at ASC LIMIT ?`,
    [itemType, limit],
  );
  return rows.map((r) => r.item_id);
}

export async function ensureReviewRow(db: SQLiteDatabase, itemId: string, itemType: ItemType): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO reviews (item_id, item_type, due_at) VALUES (?, ?, datetime('now'))`,
    [itemId, itemType],
  );
}

/**
 * SM-2-style spacing, with one personalization on top: when the correct answer came
 * from the user's currently-strongest method (methodConfidence close to 1), we trust
 * it a bit more and extend the interval further. A correct answer from a weak method
 * is trusted less and reviewed sooner, since it's more likely to have been a guess.
 */
export async function scheduleNextReview(
  db: SQLiteDatabase,
  itemId: string,
  itemType: ItemType,
  correct: boolean,
  method: TeachingMethod,
  methodConfidence: number,
): Promise<void> {
  const row = await db.getFirstAsync<ReviewRow>(`SELECT * FROM reviews WHERE item_id = ?`, [itemId]);
  const current = row ?? {
    item_id: itemId,
    item_type: itemType,
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    due_at: new Date().toISOString(),
  };

  let repetitions = current.repetitions;
  let intervalDays = current.interval_days;
  let easeFactor = current.ease_factor;

  if (!correct) {
    repetitions = 0;
    intervalDays = 1 / 24; // retry within the hour
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    repetitions += 1;
    const confidenceMultiplier = 0.6 + methodConfidence * 0.8; // ranges ~0.6x to ~1.4x
    if (repetitions === 1) {
      intervalDays = 1 * confidenceMultiplier;
    } else if (repetitions === 2) {
      intervalDays = 3 * confidenceMultiplier;
    } else {
      intervalDays = current.interval_days * easeFactor * confidenceMultiplier;
    }
    easeFactor = Math.min(3.0, easeFactor + 0.05);
  }

  const dueAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

  await db.runAsync(
    `INSERT INTO reviews (item_id, item_type, ease_factor, interval_days, repetitions, due_at, last_method, last_result, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(item_id) DO UPDATE SET
       ease_factor = excluded.ease_factor,
       interval_days = excluded.interval_days,
       repetitions = excluded.repetitions,
       due_at = excluded.due_at,
       last_method = excluded.last_method,
       last_result = excluded.last_result,
       updated_at = datetime('now')`,
    [itemId, itemType, easeFactor, intervalDays, repetitions, dueAt, method, correct ? 1 : 0],
  );
}
