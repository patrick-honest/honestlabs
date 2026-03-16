import Database from "better-sqlite3";
import path from "path";

// ---------------------------------------------------------------------------
// SQLite cache layer — uses better-sqlite3 directly for maximum read perf.
// Schema: key-value store with TTL support.
// ---------------------------------------------------------------------------

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dbPath =
      process.env.CACHE_DB_PATH ||
      path.join(process.cwd(), "prisma", "cache.db");
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL"); // faster concurrent reads
    _db.pragma("synchronous = NORMAL");
    initCache(_db);
  }
  return _db;
}

function initCache(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT
    )
  `);
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
  const row = db
    .prepare(
      "SELECT value, updated_at, expires_at FROM cache WHERE key = ?",
    )
    .get(key) as
    | { value: string; updated_at: string; expires_at: string | null }
    | undefined;

  if (!row) return null;

  // Check expiry
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    // Expired — delete and return null
    db.prepare("DELETE FROM cache WHERE key = ?").run(key);
    return null;
  }

  return {
    data: JSON.parse(row.value) as T,
    updatedAt: row.updated_at,
  };
}

/**
 * Write a value to the cache. Optional TTL in hours (default: 25h — slightly
 * longer than one day so daily cron always has valid data).
 */
export function setCached(
  key: string,
  data: unknown,
  ttlHours: number = 25,
): void {
  const db = getDb();
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
  db.prepare("DELETE FROM cache WHERE key = ?").run(key);
}

/**
 * Get the age of a cache entry without reading the full payload.
 */
export function getCacheAge(
  key: string,
): { updatedAt: string; ageMinutes: number } | null {
  const db = getDb();
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
