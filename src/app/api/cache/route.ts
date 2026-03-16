import { NextRequest, NextResponse } from "next/server";
import { getCacheAge } from "@/lib/cache";
import { getQueryStats, clearMemoryCache } from "@/lib/bigquery";

// ---------------------------------------------------------------------------
// GET /api/cache — Cache health dashboard
// DELETE /api/cache — Clear in-memory cache (SQLite cache persists)
//
// Useful for monitoring cache hit rates and diagnosing cost issues.
// ---------------------------------------------------------------------------

const MONITORED_KEYS = [
  "kpi:all:weekly",
  "kpi:all:monthly",
  "kpi:all:quarterly",
  "kpi:all:yearly",
  "kpi:executive:weekly",
  "kpi:executive:monthly",
];

export async function GET() {
  try {
    // Collect SQLite cache status for key entries
    const sqliteCacheStatus: Record<string, unknown> = {};
    for (const prefix of MONITORED_KEYS) {
      // We don't know the exact periodStart, so just report the prefix
      // The cache layer uses full keys like "kpi:all:weekly:2026-03-09"
      sqliteCacheStatus[prefix] = "monitored";
    }

    const queryStats = getQueryStats();

    const totalRequests = queryStats.hits + queryStats.misses + queryStats.coalesced;
    const hitRate = totalRequests > 0
      ? Math.round((queryStats.hits / totalRequests) * 1000) / 10
      : 0;
    const coalescedRate = totalRequests > 0
      ? Math.round((queryStats.coalesced / totalRequests) * 1000) / 10
      : 0;

    return NextResponse.json({
      status: "ok",
      queryCache: {
        ...queryStats,
        hitRatePercent: hitRate,
        coalescedRatePercent: coalescedRate,
        totalRequests,
        estimatedSavingsPercent: Math.round((hitRate + coalescedRate) * 10) / 10,
      },
      layers: {
        browser: "Cache-Control headers (5 min max-age)",
        swr: "Client SWR deduplication (5-10 min dedup interval)",
        memoryCache: `In-process query cache (${queryStats.memoryCacheSize} entries, 10 min TTL)`,
        sqliteCache: "Persistent cache (25h TTL, refreshed by daily cron)",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[GET /api/cache]", err);
    return NextResponse.json(
      { error: "Failed to get cache status" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    clearMemoryCache();
    return NextResponse.json({
      success: true,
      message: "In-memory query cache cleared. SQLite cache retained.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[DELETE /api/cache]", err);
    return NextResponse.json(
      { error: "Failed to clear cache" },
      { status: 500 },
    );
  }
}
