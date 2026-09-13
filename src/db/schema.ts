import type { SQLiteDatabase } from "expo-sqlite";

/**
 * method_stats is keyed by item_type + method, not by individual item: the adaptive
 * engine tracks which teaching method works for THIS user in general, not per-word.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS method_stats (
      item_type TEXT NOT NULL,
      method TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      correct INTEGER NOT NULL DEFAULT 0,
      ewma_success REAL NOT NULL DEFAULT 0.5,
      ewma_latency_ms REAL NOT NULL DEFAULT 4000,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (item_type, method)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      item_id TEXT PRIMARY KEY NOT NULL,
      item_type TEXT NOT NULL,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      interval_days REAL NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      due_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_method TEXT,
      last_result INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      method TEXT NOT NULL,
      correct INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_attempts_item ON attempts(item_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_due ON reviews(due_at);
  `);
}
