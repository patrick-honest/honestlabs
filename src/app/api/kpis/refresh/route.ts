import { NextRequest, NextResponse } from "next/server";
import { setCached, cacheKey } from "@/lib/cache";
import {
  getCurrentPeriod,
  getPreviousPeriod,
  toSqlDate,
  type Cycle,
} from "@/lib/dates";
import {
  getEligibleAndTransactors,
  getSpendMetrics,
  getNewCustomerActivationRate,
  getDecisionFunnel,
  getPortfolioSnapshot,
  getRepaymentMetrics,
} from "@/services/queries/kpi";
import {
  ALL_KPI_DEFINITIONS,
  getKpisBySection,
} from "@/config/kpi-definitions";
import { analyzeTrends, type MetricPoint } from "@/services/trend-analyzer";
import type { KpiMetric } from "@/types/reports";
import type { KpiPayload } from "../route";

// ---------------------------------------------------------------------------
// POST /api/kpis/refresh
//
// Body: { cycle?: string, metric?: string, section?: string }
// If metric is provided, refresh only that one query function.
// If omitted, refresh all KPIs for the given cycle.
// ---------------------------------------------------------------------------

const VALID_CYCLES = new Set<string>(["weekly", "monthly", "quarterly", "yearly"]);

// Map of query function names to their actual functions
const QUERY_FN_MAP: Record<
  string,
  (start: Date, end: Date) => Promise<unknown>
> = {
  getEligibleAndTransactors: (s, e) => getEligibleAndTransactors(s, e),
  getSpendMetrics: (s, e) => getSpendMetrics(s, e),
  getNewCustomerActivationRate: (s, e) => getNewCustomerActivationRate(s, e),
  getDecisionFunnel: (s, e) => getDecisionFunnel(s, e),
  getRepaymentMetrics: (s, e) => getRepaymentMetrics(s, e),
};

// Snapshot queries that take a single date instead of a range
const SNAPSHOT_QUERY_FN_MAP: Record<
  string,
  (date: Date) => Promise<unknown>
> = {
  getPortfolioSnapshot: (d) => getPortfolioSnapshot(d),
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cycle = ((body.cycle as string) || "weekly") as Cycle;
    const metricFilter = body.metric as string | undefined;
    const sectionFilter = body.section as string | undefined;

    if (!VALID_CYCLES.has(cycle)) {
      return NextResponse.json(
        { error: `Invalid cycle. Must be one of: ${[...VALID_CYCLES].join(", ")}` },
        { status: 400 },
      );
    }

    const period = getCurrentPeriod(cycle);
    const prevPeriod = getPreviousPeriod(cycle, period.start);
    const periodStart = toSqlDate(period.start);
    const periodEnd = toSqlDate(period.end);

    // Determine which query functions to run
    let queryFns: string[];
    if (metricFilter) {
      const def = ALL_KPI_DEFINITIONS.find((d) => d.key === metricFilter);
      queryFns = def ? [def.queryFn] : [];
    } else if (sectionFilter) {
      const defs = getKpisBySection(sectionFilter);
      queryFns = [...new Set(defs.map((d) => d.queryFn))];
    } else {
      queryFns = [
        ...new Set(ALL_KPI_DEFINITIONS.map((d) => d.queryFn)),
      ];
    }

    if (queryFns.length === 0) {
      return NextResponse.json(
        { error: `No query functions found for metric "${metricFilter}"` },
        { status: 400 },
      );
    }

    // Run all required queries for current and previous periods in parallel
    const queryResults: Record<string, unknown> = {};
    const prevQueryResults: Record<string, unknown> = {};

    await Promise.all(
      queryFns.map(async (fnName) => {
        if (SNAPSHOT_QUERY_FN_MAP[fnName]) {
          const [curr, prev] = await Promise.all([
            SNAPSHOT_QUERY_FN_MAP[fnName](period.end),
            SNAPSHOT_QUERY_FN_MAP[fnName](prevPeriod.end),
          ]);
          queryResults[fnName] = curr;
          prevQueryResults[fnName] = prev;
        } else if (QUERY_FN_MAP[fnName]) {
          const [curr, prev] = await Promise.all([
            QUERY_FN_MAP[fnName](period.start, period.end),
            QUERY_FN_MAP[fnName](prevPeriod.start, prevPeriod.end),
          ]);
          queryResults[fnName] = curr;
          prevQueryResults[fnName] = prev;
        }
      }),
    );

    // Build KPI metrics from query results
    const kpis = buildKpiMetrics(queryResults, prevQueryResults, sectionFilter);
    const chartData = queryResults;
    const trends = buildTrends(queryResults, prevQueryResults);

    const payload: KpiPayload = {
      kpis,
      chartData,
      trends,
      definitions: ALL_KPI_DEFINITIONS,
    };

    // Store in cache
    const key = cacheKey("kpi", sectionFilter || "all", cycle, periodStart);
    setCached(key, payload);

    // Also cache individual query results for granular refresh
    for (const [fnName, data] of Object.entries(queryResults)) {
      setCached(
        cacheKey("query", fnName, cycle, periodStart),
        { current: data, previous: prevQueryResults[fnName] },
      );
    }

    return NextResponse.json({
      kpis,
      chartData,
      trends,
      asOf: new Date().toISOString(),
      dataRange: { start: periodStart, end: periodEnd },
      refreshed: queryFns,
    });
  } catch (err) {
    console.error("[POST /api/kpis/refresh]", err);
    return NextResponse.json(
      { error: "Failed to refresh KPIs", details: String(err) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildKpiMetrics(
  current: Record<string, unknown>,
  previous: Record<string, unknown>,
  sectionFilter?: string,
): KpiMetric[] {
  const defs = sectionFilter
    ? getKpisBySection(sectionFilter)
    : ALL_KPI_DEFINITIONS;

  return defs.map((def) => {
    const currValue = extractMetricValue(def.key, current[def.queryFn]);
    const prevValue = extractMetricValue(def.key, previous[def.queryFn]);

    const changePercent =
      prevValue !== null && prevValue !== 0
        ? ((currValue - prevValue) / Math.abs(prevValue)) * 100
        : null;

    const direction: "up" | "down" | "flat" =
      changePercent === null || Math.abs(changePercent) < 0.5
        ? "flat"
        : changePercent > 0
          ? "up"
          : "down";

    return {
      metric: def.key,
      label: def.label,
      value: currValue,
      prevValue,
      unit: def.unit,
      changePercent: changePercent !== null ? Math.round(changePercent * 10) / 10 : null,
      direction,
    };
  });
}

function extractMetricValue(key: string, queryResult: unknown): number {
  if (!queryResult) return 0;

  // Array results (time-series) — take the latest entry
  if (Array.isArray(queryResult)) {
    if (queryResult.length === 0) return 0;
    const latest = queryResult[queryResult.length - 1];
    return extractFromRow(key, latest);
  }

  // Snapshot object (e.g. PortfolioSnapshot)
  return extractFromRow(key, queryResult as Record<string, unknown>);
}

function extractFromRow(key: string, row: Record<string, unknown>): number {
  // Direct field match
  if (key in row && typeof row[key] === "number") return row[key] as number;

  // Common mappings between KPI keys and query result fields
  const fieldMap: Record<string, string> = {
    total_spend: "total_spend_idr",
    avg_spend_per_txn: "avg_spend_idr",
    avg_spend_online: "avg_spend_online_idr",
    avg_spend_offline: "avg_spend_offline_idr",
    avg_spend_qris: "avg_spend_qris_idr",
    approval_rate: "approval_rate_pct",
    total_applications: "total_decisions",
    activation_rate_7d: "activation_rate_pct",
    cards_activated: "activated_count",
    new_customer_activation_rate: "activation_rate_pct",
    new_accounts: "approved",
    total_active_accounts: "active_accounts",
    total_delinquent_rate: "total_delinquent_rate",
  };

  const mappedField = fieldMap[key];
  if (mappedField && mappedField in row && typeof row[mappedField] === "number") {
    return row[mappedField] as number;
  }

  // DPD bucket extraction from portfolio snapshot
  if (key.startsWith("dpd_") || key === "current_dpd_0") {
    const buckets = (row as Record<string, unknown>).dpd_buckets;
    if (Array.isArray(buckets)) {
      const bucketMap: Record<string, string> = {
        current_dpd_0: "Current",
        dpd_1_30: "1-30 DPD",
        dpd_31_60: "31-60 DPD",
        dpd_61_90: "61-90 DPD",
        dpd_90_plus: "90+ DPD",
      };
      const label = bucketMap[key];
      const bucket = buckets.find(
        (b: Record<string, unknown>) => b.label === label,
      );
      return (bucket?.count as number) ?? 0;
    }
  }

  // Computed: txn_per_eligible_user
  if (key === "txn_per_eligible_user") {
    const txns = (row.total_transactions as number) ?? 0;
    const eligible = (row.eligible_count as number) ?? 1;
    return eligible > 0 ? Math.round((txns / eligible) * 100) / 100 : 0;
  }

  return 0;
}

function buildTrends(
  current: Record<string, unknown>,
  previous: Record<string, unknown>,
): string[] {
  const allTrends: string[] = [];

  // Build trends for time-series query results
  const trendConfigs: { fnName: string; metricField: string; label: string }[] = [
    { fnName: "getEligibleAndTransactors", metricField: "eligible_count", label: "Eligible Accounts" },
    { fnName: "getEligibleAndTransactors", metricField: "spend_active_rate", label: "Spend Active Rate" },
    { fnName: "getSpendMetrics", metricField: "total_spend_idr", label: "Total Spend (IDR)" },
    { fnName: "getSpendMetrics", metricField: "avg_spend_idr", label: "Avg Spend per Txn (IDR)" },
    { fnName: "getNewCustomerActivationRate", metricField: "activation_rate_pct", label: "Activation Rate" },
    { fnName: "getDecisionFunnel", metricField: "approval_rate_pct", label: "Approval Rate" },
  ];

  for (const { fnName, metricField, label } of trendConfigs) {
    const currData = current[fnName];
    const prevData = previous[fnName];

    if (!Array.isArray(currData)) continue;

    const currPoints: MetricPoint[] = currData.map(
      (r: Record<string, unknown>) => ({
        date: r.week_start as string,
        value: (r[metricField] as number) ?? 0,
      }),
    );
    const prevPoints: MetricPoint[] = Array.isArray(prevData)
      ? prevData.map((r: Record<string, unknown>) => ({
          date: r.week_start as string,
          value: (r[metricField] as number) ?? 0,
        }))
      : [];

    const bullets = analyzeTrends(currPoints, prevPoints, label);
    allTrends.push(...bullets.slice(0, 2)); // Top 2 bullets per metric
  }

  return allTrends.slice(0, 10); // Cap at 10 total trend bullets
}
