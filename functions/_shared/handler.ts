/**
 * Generic request handler for deep-dive endpoints.
 * Each endpoint provides a query function that receives date params and env,
 * and returns the data to send as JSON.
 */

import type { Env } from "./bigquery-auth";
import { getCached, setCached, cacheKey } from "./cache";

interface HandlerOptions {
  section: string;
  queryFn: (startDate: string, endDate: string, env: Env) => Promise<unknown>;
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

    try {
      const key = cacheKey(section, "query", startDate);

      // Check cache
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

      // Query BigQuery
      const result = await queryFn(startDate, endDate, env);

      // Cache
      await setCached(key, result, env.KPI_CACHE, cacheTtl);

      return new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
          "X-Cache": cached ? "HIT-STALE" : "MISS",
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
