import { NextRequest, NextResponse } from "next/server";
import { generateAllReports } from "@/services/report-generator";
import { setCached, cacheKey } from "@/lib/cache";
import {
  getCurrentPeriod,
  getPreviousPeriod,
  toSqlDate,
} from "@/lib/dates";
import {
  getEligibleAndTransactors,
  getSpendMetrics,
  getNewCustomerActivationRate,
  getDecisionFunnel,
  getPortfolioSnapshot,
  getRepaymentMetrics,
} from "@/services/queries/kpi";
import { clearMemoryCache } from "@/lib/bigquery";
import type { Cycle } from "@/lib/dates";

// ---------------------------------------------------------------------------
// POST /api/cron/daily
//
// Triggered by a daily cron job. Generates all reports and refreshes all
// KPI caches for each cycle.
// Protected by CRON_SECRET env var.
// ---------------------------------------------------------------------------

const CYCLES_TO_REFRESH: Cycle[] = ["weekly", "monthly", "quarterly", "yearly"];

export async function POST(request: NextRequest) {
  try {
    // --- Auth check ---
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[CRON] CRON_SECRET env var is not set");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 },
      );
    }

    const authHeader = request.headers.get("authorization");
    const bodySecret = await request
      .json()
      .then((b) => b?.secret as string | undefined)
      .catch(() => undefined);

    const providedSecret =
      authHeader?.replace("Bearer ", "") || bodySecret;

    if (providedSecret !== cronSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // --- Run all refreshes ---
    const summary: Record<string, unknown> = {};
    const startTime = Date.now();

    for (const cycle of CYCLES_TO_REFRESH) {
      const cycleSummary: Record<string, unknown> = {};

      try {
        // 1. Generate reports for this cycle
        const reports = await generateAllReports(cycle);
        cycleSummary.reportsGenerated = reports.length;
        cycleSummary.reportIds = reports.map((r) => r.id);

        // 2. Refresh raw query caches
        const period = getCurrentPeriod(cycle);
        const prevPeriod = getPreviousPeriod(cycle, period.start);
        const periodStart = toSqlDate(period.start);

        const queryResults = await runAllQueries(period, prevPeriod);

        for (const [fnName, { current, previous }] of Object.entries(queryResults)) {
          setCached(
            cacheKey("query", fnName, cycle, periodStart),
            { current, previous },
          );
        }

        cycleSummary.queriesCached = Object.keys(queryResults).length;
        cycleSummary.status = "success";
      } catch (err) {
        console.error(`[CRON] Failed cycle=${cycle}:`, err);
        cycleSummary.status = "error";
        cycleSummary.error = String(err);
      }

      summary[cycle] = cycleSummary;
    }

    // Clear in-memory cache so fresh data is picked up on next request
    clearMemoryCache();

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      durationMs,
      summary,
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[POST /api/cron/daily]", err);
    return NextResponse.json(
      { error: "Cron job failed", details: String(err) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helper: run all BigQuery queries for a period
// ---------------------------------------------------------------------------

async function runAllQueries(
  period: { start: Date; end: Date },
  prevPeriod: { start: Date; end: Date },
): Promise<
  Record<string, { current: unknown; previous: unknown }>
> {
  const [
    eligibleCurr,
    eligiblePrev,
    spendCurr,
    spendPrev,
    activationCurr,
    activationPrev,
    decisionCurr,
    decisionPrev,
    portfolioCurr,
    portfolioPrev,
    repaymentCurr,
    repaymentPrev,
  ] = await Promise.all([
    getEligibleAndTransactors(period.start, period.end),
    getEligibleAndTransactors(prevPeriod.start, prevPeriod.end),
    getSpendMetrics(period.start, period.end),
    getSpendMetrics(prevPeriod.start, prevPeriod.end),
    getNewCustomerActivationRate(period.start, period.end),
    getNewCustomerActivationRate(prevPeriod.start, prevPeriod.end),
    getDecisionFunnel(period.start, period.end),
    getDecisionFunnel(prevPeriod.start, prevPeriod.end),
    getPortfolioSnapshot(period.end),
    getPortfolioSnapshot(prevPeriod.end),
    getRepaymentMetrics(period.start, period.end),
    getRepaymentMetrics(prevPeriod.start, prevPeriod.end),
  ]);

  return {
    getEligibleAndTransactors: { current: eligibleCurr, previous: eligiblePrev },
    getSpendMetrics: { current: spendCurr, previous: spendPrev },
    getNewCustomerActivationRate: { current: activationCurr, previous: activationPrev },
    getDecisionFunnel: { current: decisionCurr, previous: decisionPrev },
    getPortfolioSnapshot: { current: portfolioCurr, previous: portfolioPrev },
    getRepaymentMetrics: { current: repaymentCurr, previous: repaymentPrev },
  };
}
