/**
 * Generic request handler for deep-dive endpoints.
 * Each endpoint provides a query function that receives date params, filters, and env,
 * and returns the data to send as JSON.
 *
 * The handler extends the startDate backwards to include 6 periods of chart context:
 *   - weekly  → 6 weeks back
 *   - monthly → 6 months back
 *   - quarterly → 18 months (6 quarters) back
 */

import type { Env } from "./bigquery-auth";
import { getCached, setCached, cacheKey } from "./cache";
import { parseFilters, hasAnyFilter, type ParsedFilters } from "./filters";

/**
 * Extend the start date backwards to include 6 periods of historical context.
 */
function extendStartDate(startDate: string, period: string): string {
  const d = new Date(startDate + "T00:00:00Z");
  switch (period) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() - 6 * 7); // 6 weeks
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() - 6); // 6 months
      break;
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() - 18); // 6 quarters
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() - 6); // 6 years
      break;
    default:
      d.setUTCMonth(d.getUTCMonth() - 6); // default to 6 months
      break;
  }
  return d.toISOString().slice(0, 10);
}

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
    const rawStartDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const period = url.searchParams.get("period") || "monthly";

    // Extend start date to include 6 periods of chart context
    const startDate = rawStartDate ? extendStartDate(rawStartDate, period) : null;

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
