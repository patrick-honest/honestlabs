"use client";

import useSWR, { type SWRConfiguration } from "swr";

// ---------------------------------------------------------------------------
// SWR-based data fetching hook with built-in caching, deduplication, and
// stale-while-revalidate semantics. Replaces raw fetch() calls to minimize
// redundant API hits and BigQuery queries.
// ---------------------------------------------------------------------------

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("Fetch failed");
    (error as unknown as Record<string, unknown>).status = res.status;
    throw error;
  }
  return res.json();
};

// Default SWR options optimized for cost reduction:
// - dedupingInterval: 5 min — identical requests within 5 min are deduplicated
// - revalidateOnFocus: false — don't refetch when user tabs back
// - revalidateOnReconnect: false — don't refetch on network reconnect
// - refreshInterval: 0 — no automatic polling (cron handles freshness)
// - errorRetryCount: 2 — limit retries on failure
const DEFAULT_OPTIONS: SWRConfiguration = {
  fetcher,
  dedupingInterval: 5 * 60 * 1000, // 5 minutes
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  refreshInterval: 0,
  errorRetryCount: 2,
  errorRetryInterval: 10_000,
};

/**
 * Cached KPI fetch with auto-refresh.
 * If GET returns 404 (cache miss), automatically triggers a POST refresh
 * to populate the cache from BigQuery, then retries.
 */
export function useKpis(cycle: string) {
  return useSWR<{
    kpis: unknown[];
    chartData: Record<string, unknown>;
    trends: string[];
    asOf: string;
    dataRange: { start: string; end: string };
  }>(
    `/api/kpis?cycle=${cycle}`,
    {
      ...DEFAULT_OPTIONS,
      dedupingInterval: 10 * 60 * 1000,
      fetcher: async (url: string) => {
        // Try GET first (cached data)
        const res = await fetch(url);
        if (res.ok) return res.json();

        // On 404 (cache miss), trigger a refresh from BigQuery
        if (res.status === 404) {
          const refreshRes = await fetch("/api/kpis/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cycle }),
          });
          if (refreshRes.ok) return refreshRes.json();
        }

        // Other errors — throw to trigger SWR error state
        const error = new Error("Fetch failed");
        (error as unknown as Record<string, unknown>).status = res.status;
        throw error;
      },
    },
  );
}

/**
 * Cached user search. Short TTL since users search for different IDs.
 */
export function useUserSearch(userId: string | null) {
  return useSWR(
    userId ? `/api/search?userId=${userId}` : null,
    {
      ...DEFAULT_OPTIONS,
      dedupingInterval: 2 * 60 * 1000, // 2 min for same user lookups
    },
  );
}

/**
 * Cached reports list.
 */
export function useReports(params: {
  cycle?: string;
  section?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.cycle) searchParams.set("cycle", params.cycle);
  if (params.section) searchParams.set("section", params.section);
  if (params.search) searchParams.set("search", params.search);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));

  const qs = searchParams.toString();
  return useSWR(
    `/api/reports${qs ? `?${qs}` : ""}`,
    {
      ...DEFAULT_OPTIONS,
      dedupingInterval: 5 * 60 * 1000,
    },
  );
}

/**
 * Generic cached fetch for any API endpoint.
 */
export function useCachedFetch<T = unknown>(
  url: string | null,
  options?: SWRConfiguration,
) {
  return useSWR<T>(url, {
    ...DEFAULT_OPTIONS,
    ...options,
  });
}
