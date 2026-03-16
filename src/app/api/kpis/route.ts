import { NextRequest, NextResponse } from "next/server";
import { getCached, cacheKey } from "@/lib/cache";
import { getCurrentPeriod, toSqlDate, type Cycle } from "@/lib/dates";
import { ALL_KPI_DEFINITIONS, getKpisBySection } from "@/config/kpi-definitions";
import type { KpiMetric } from "@/types/reports";

// ---------------------------------------------------------------------------
// GET /api/kpis?cycle=weekly&section=executive
//
// Reads pre-computed KPI data from the SQLite cache.
// Returns 404 if no cached data exists (caller should trigger a refresh).
// ---------------------------------------------------------------------------

const VALID_CYCLES = new Set<string>(["weekly", "monthly", "quarterly", "yearly"]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cycle = (searchParams.get("cycle") || "weekly") as Cycle;
    const sectionFilter = searchParams.get("section") || undefined;

    if (!VALID_CYCLES.has(cycle)) {
      return NextResponse.json(
        { error: `Invalid cycle. Must be one of: ${[...VALID_CYCLES].join(", ")}` },
        { status: 400 },
      );
    }

    const period = getCurrentPeriod(cycle);
    const periodStart = toSqlDate(period.start);
    const periodEnd = toSqlDate(period.end);

    // Build cache key for the main KPI blob
    const key = cacheKey("kpi", sectionFilter || "all", cycle, periodStart);
    const cached = getCached<KpiPayload>(key);

    if (!cached) {
      return NextResponse.json(
        {
          error: "Data not yet generated. Trigger a refresh.",
          cacheKey: key,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      kpis: cached.data.kpis,
      chartData: cached.data.chartData,
      trends: cached.data.trends,
      asOf: cached.updatedAt,
      dataRange: { start: periodStart, end: periodEnd },
    });
  } catch (err) {
    console.error("[GET /api/kpis]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Payload shape stored in cache
// ---------------------------------------------------------------------------

export interface KpiPayload {
  kpis: KpiMetric[];
  chartData: Record<string, unknown>;
  trends: string[];
  definitions: typeof ALL_KPI_DEFINITIONS;
}
