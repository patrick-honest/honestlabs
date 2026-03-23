/**
 * Generic request handler for deep-dive endpoints.
 * Each endpoint provides a query function that receives date params, filters, and env,
 * and returns the data to send as JSON.
 */

import type { Env } from "./bigquery-auth";
import { getCached, setCached, cacheKey } from "./cache";
import { parseFilters, hasAnyFilter, type ParsedFilters } from "./filters";

interface HandlerOptions {
  section: string;
  queryFn: (startDate: string, endDate: string, env: Env, filters: ParsedFilters) => Promise<unknown>;
  cacheTtl?: number;
}

export function createHandler(options: HandlerOptions) {
  const { section, queryFn, cacheTtl = 3600 } = options;

  return async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
    const { request, env } = context;
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "Missing startDate or endDate query parameters" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const filters = parseFilters(url);
    const hasFilters = hasAnyFilter(filters);

    try {
      // Include filter params in cache key so filtered/unfiltered results are cached separately
      const filterKey = hasFilters
        ? Object.entries(filters)
            .filter(([, v]) => v.length > 0)
            .map(([k, v]) => `${k}=${v.sort().join("+")}`)
            .join("&")
        : "";
      const key = cacheKey(section, "query", `${startDate}:${filterKey}`);

      // Check cache (skip cache for filtered queries to keep it simple)
      if (!hasFilters) {
        const cached = await getCached<unknown>(key, env.KPI_CACHE);
        if (cached && cached.fresh) {
          return new Response(JSON.stringify(cached.data), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300",
              "X-Cache": "HIT-FRESH",
            },
          });
        }
      }

      // Query BigQuery with filters
      const result = await queryFn(startDate, endDate, env, filters);

      // Cache unfiltered results only
      if (!hasFilters) {
        await setCached(key, result, env.KPI_CACHE, cacheTtl);
      }

      return new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": hasFilters ? "no-cache" : "public, max-age=300",
          "X-Cache": "MISS",
        },
      });
    } catch (error) {
      console.error(`${section} query error:`, error);
      return new Response(
        JSON.stringify({
          error: `Failed to fetch ${section} data`,
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  };
}
