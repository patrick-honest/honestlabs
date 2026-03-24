/**
 * KV-based caching layer for Cloudflare Workers.
 * Replaces the SQLite/better-sqlite3 cache from the server-side app.
 */

// Type stub for Cloudflare KV (avoids @cloudflare/workers-types dependency)
declare type KVNamespace = {
  get(key: string, options?: { type?: string }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

interface CacheEntry<T> {
  data: T;
  storedAt: number;
}

const DEFAULT_TTL = 3600; // 1 hour
const MIN_REFRESH_INTERVAL = 300; // 5 minutes — don't re-query BQ within this window

export async function getCached<T>(
  key: string,
  kv: KVNamespace | undefined,
): Promise<{ data: T; fresh: boolean } | null> {
  if (!kv) return null;

  try {
    const raw = await kv.get(key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = (Date.now() - entry.storedAt) / 1000;
    return { data: entry.data, fresh: age < MIN_REFRESH_INTERVAL };
  } catch {
    return null;
  }
}

export async function setCached(
  key: string,
  data: unknown,
  kv: KVNamespace | undefined,
  ttlSeconds: number = DEFAULT_TTL,
): Promise<void> {
  if (!kv) return;

  const entry: CacheEntry<unknown> = {
    data,
    storedAt: Date.now(),
  };

  await kv.put(key, JSON.stringify(entry), {
    expirationTtl: ttlSeconds,
  });
}

export function cacheKey(
  section: string,
  cycle: string,
  startDate: string,
): string {
  return `${section}:${cycle}:${startDate}`;
}
