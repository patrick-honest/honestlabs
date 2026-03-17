// ---------------------------------------------------------------------------
// SQLite cache layer — uses better-sqlite3 directly for maximum read perf.
// In demo mode / Vercel serverless, the native module may not be available —
// all functions gracefully no-op so the app still renders with sample data.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

let _db: any = null;
let _unavailable = false;

function getDb(): any {
  if (_unavailable) return null;
  if (_db) return _db;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");

    const dbPath =
      process.env.CACHE_DB_PATH ||
      path.join(process.cwd(), "prisma", "cache.db");
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("synchronous = NORMAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT
      )
    `);
    return _db;
  } catch {
    _unavailable = true;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CacheEntry<T> {
  data: T;
  updatedAt: string;
}

/**
 * Read a cached value. Returns null on miss or if expired.
 */
export function getCached<T>(key: string): CacheEntry<T> | null {
  const db = getDb();
  if (!db) return null;

  const row = db
    .prepare("SELECT value, updated_at, expires_at FROM cache WHERE key = ?")
    .get(key) as
    | { value: string; updated_at: string; expires_at: string | null }
    | undefined;

  if (!row) return null;

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    db.prepare("DELETE FROM cache WHERE key = ?").run(key);
    return null;
  }

  return {
    data: JSON.parse(row.value) as T,
    updatedAt: row.updated_at,
  };
}

/**
 * Write a value to the cache. Optional TTL in hours (default: 25h).
 */
export function setCached(
  key: string,
  data: unknown,
  ttlHours: number = 25,
): void {
  const db = getDb();
  if (!db) return;

  const now = new Date();
  const updatedAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + ttlHours * 60 * 60 * 1000,
  ).toISOString();

  db.prepare(
    `INSERT INTO cache (key, value, updated_at, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at,
       expires_at = excluded.expires_at`,
  ).run(key, JSON.stringify(data), updatedAt, expiresAt);
}

/**
 * Remove a specific key from the cache.
 */
export function invalidateCache(key: string): void {
  const db = getDb();
  if (!db) return;
  db.prepare("DELETE FROM cache WHERE key = ?").run(key);
}

/**
 * Get the age of a cache entry without reading the full payload.
 */
export function getCacheAge(
  key: string,
): { updatedAt: string; ageMinutes: number } | null {
  const db = getDb();
  if (!db) return null;

  const row = db
    .prepare("SELECT updated_at FROM cache WHERE key = ?")
    .get(key) as { updated_at: string } | undefined;

  if (!row) return null;

  const updatedAt = new Date(row.updated_at);
  const ageMinutes = (Date.now() - updatedAt.getTime()) / 60_000;

  return { updatedAt: row.updated_at, ageMinutes: Math.round(ageMinutes) };
}

/**
 * Build a cache key following the convention:
 *   "{section}:{metric}:{cycle}:{periodStart}"
 */
export function cacheKey(
  section: string,
  metric: string,
  cycle: string,
  periodStart: string,
): string {
  return `${section}:${metric}:${cycle}:${periodStart}`;
}
