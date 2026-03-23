/**
 * GET /api/kpis?cycle=weekly
 * POST /api/kpis (force refresh)
 *
 * Returns KPI data for the main dashboard.
 */

import { runQuery, TABLES, toSqlDate, getLastFullWeek, getPriorWeek, getExtendedRange } from "../_shared/bigquery-client";
import { getCached, setCached, cacheKey } from "../_shared/cache";
import type { Env } from "../_shared/bigquery-auth";

// ---------------------------------------------------------------------------
// Types (matching src/types/reports.ts)
// ---------------------------------------------------------------------------

interface KpiMetric {
  metric: string;
  label: string;
  value: number;
  prevValue: number | null;
  unit: "count" | "percent" | "idr" | "usd";
  changePercent: number | null;
  direction: "up" | "down" | "flat";
}

interface EligibleRow {
  week_start: string;
  eligible_count: number;
  transactor_count: number;
  total_transactions: number;
  spend_active_rate: number;
}

interface SpendRow {
  week_start: string;
  avg_spend_idr: number;
  avg_spend_usd: number;
  avg_spend_online_idr: number;
  avg_spend_offline_idr: number;
  avg_spend_qris_idr: number;
  total_spend_idr: number;
  total_txn_count: number;
}

interface DecisionRow {
  week_start: string;
  total_decisions: number;
  approved: number;
  declined: number;
  waitlisted: number;
  approval_rate_pct: number;
}

interface DpdRow {
  label: string;
  count: number;
  exposure_idr: number;
}

interface SummaryRow {
  total_accounts: number;
  active_accounts: number;
}

// ---------------------------------------------------------------------------
// Query functions (ported from src/services/queries/kpi.ts)
// ---------------------------------------------------------------------------

async function getEligibleAndTransactors(startDate: string, endDate: string, env: Env) {
  const sql = `
    WITH card_unblocked AS (
      SELECT DISTINCT f9_dw005_loc_acct AS loc_acct
      FROM ${TABLES.principal_card_updates}
      WHERE f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL
        AND TRIM(CAST(f9_dw005_1st_unblk_all_mtd_tms AS STRING)) != ''
        AND f9_dw005_hce_txn_ind LIKE '%0%'
        AND f9_dw005_net_txn_ind LIKE '%0%'
        AND fx_dw005_contc_less_flg LIKE '%Y%'
        AND f9_dw005_contc_txn_ind LIKE '%0%'
    ),
    weekly_eligible AS (
      SELECT
        DATE_TRUNC(dw4.f9_dw004_bus_dt, ISOWEEK) AS week_start,
        COUNT(DISTINCT dw4.p9_dw004_loc_acct) AS eligible_count
      FROM ${TABLES.financial_account_updates} dw4
      JOIN card_unblocked cu ON dw4.p9_dw004_loc_acct = cu.loc_acct
      WHERE dw4.f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND EXTRACT(DAYOFWEEK FROM dw4.f9_dw004_bus_dt) = 1
        AND dw4.fx_dw004_loc_stat IN ('G', 'N')
        AND dw4.f9_dw004_curr_dpd = 0
      GROUP BY week_start
    ),
    card_acct_map AS (
      SELECT DISTINCT f9_dw005_crn AS crn, f9_dw005_loc_acct AS loc_acct
      FROM ${TABLES.principal_card_updates}
    ),
    weekly_transactors AS (
      SELECT
        DATE_TRUNC(dw7.f9_dw007_dt, ISOWEEK) AS week_start,
        COUNT(DISTINCT cam.loc_acct) AS transactor_count,
        COUNT(*) AS total_transactions
      FROM ${TABLES.authorized_transaction} dw7
      JOIN card_acct_map cam ON dw7.f9_dw007_prin_crn = cam.crn
      WHERE dw7.f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
        AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY week_start
    )
    SELECT
      FORMAT_DATE('%Y-%m-%d', e.week_start) AS week_start,
      e.eligible_count,
      COALESCE(t.transactor_count, 0) AS transactor_count,
      COALESCE(t.total_transactions, 0) AS total_transactions,
      ROUND(SAFE_DIVIDE(COALESCE(t.transactor_count, 0), e.eligible_count) * 100, 2) AS spend_active_rate
    FROM weekly_eligible e
    LEFT JOIN weekly_transactors t ON e.week_start = t.week_start
    ORDER BY e.week_start
  `;
  return runQuery<EligibleRow>(sql, { startDate, endDate }, env);
}

async function getSpendMetrics(startDate: string, endDate: string, env: Env) {
  const sql = `
    WITH valid_spend AS (
      SELECT
        DATE_TRUNC(dw7.f9_dw007_dt, ISOWEEK) AS week_start,
        dw7.fx_dw007_txn_typ AS txn_typ,
        dw7.fx_dw007_rte_dest AS rte_dest,
        dw7.f9_dw007_amt_req / 100.0 AS amt_idr,
        COALESCE(dw9.f9_dw009_setl_amt / 100.0 / 16000.0, 0) AS amt_usd
      FROM ${TABLES.authorized_transaction} dw7
      LEFT JOIN ${TABLES.posted_transaction} dw9
        ON dw7.fx_dw007_txn_id = dw9.fx_dw009_txn_id
       AND dw7.fx_dw007_given_apv_cde = dw9.fx_dw009_apv_cde
      WHERE dw7.f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
        AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND dw7.f9_dw007_ori_amt > 0
    )
    SELECT
      FORMAT_DATE('%Y-%m-%d', week_start) AS week_start,
      ROUND(AVG(amt_idr), 0) AS avg_spend_idr,
      ROUND(AVG(amt_usd), 2) AS avg_spend_usd,
      ROUND(AVG(CASE WHEN txn_typ = 'TM' THEN amt_idr END), 0) AS avg_spend_online_idr,
      ROUND(AVG(CASE WHEN txn_typ != 'TM' AND NOT (txn_typ = 'RA' AND rte_dest = 'L') THEN amt_idr END), 0) AS avg_spend_offline_idr,
      ROUND(AVG(CASE WHEN txn_typ = 'RA' AND rte_dest = 'L' THEN amt_idr END), 0) AS avg_spend_qris_idr,
      ROUND(SUM(amt_idr), 0) AS total_spend_idr,
      COUNT(*) AS total_txn_count
    FROM valid_spend
    GROUP BY week_start
    ORDER BY week_start
  `;
  return runQuery<SpendRow>(sql, { startDate, endDate }, env);
}

async function getDecisionFunnel(startDate: string, endDate: string, env: Env) {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
      COUNT(*) AS total_decisions,
      COUNTIF(decision = 'APPROVED') AS approved,
      COUNTIF(decision = 'DECLINED') AS declined,
      COUNTIF(decision = 'WAITLISTED') AS waitlisted,
      ROUND(SAFE_DIVIDE(COUNTIF(decision = 'APPROVED'), COUNT(*)) * 100, 2) AS approval_rate_pct
    FROM ${TABLES.decision_completed}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY week_start
    ORDER BY week_start
  `;
  return runQuery<DecisionRow>(sql, { startDate, endDate }, env);
}

async function getPortfolioSnapshot(snapshotDate: string, env: Env) {
  const dpdSql = `
    SELECT
      CASE
        WHEN f9_dw004_curr_dpd = 0 THEN 'Current'
        WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30 DPD'
        WHEN f9_dw004_curr_dpd BETWEEN 31 AND 60 THEN '31-60 DPD'
        WHEN f9_dw004_curr_dpd BETWEEN 61 AND 90 THEN '61-90 DPD'
        WHEN f9_dw004_curr_dpd > 90 THEN '90+ DPD'
      END AS label,
      COUNT(DISTINCT p9_dw004_loc_acct) AS count,
      ROUND(SUM(f9_dw004_clo_bal / 100.0), 0) AS exposure_idr
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt = @snapshotDate
      AND f9_dw004_curr_dpd >= 0
    GROUP BY label
    ORDER BY
      CASE label
        WHEN 'Current' THEN 1
        WHEN '1-30 DPD' THEN 2
        WHEN '31-60 DPD' THEN 3
        WHEN '61-90 DPD' THEN 4
        WHEN '90+ DPD' THEN 5
      END
  `;

  const summarySql = `
    SELECT
      COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts,
      COUNT(DISTINCT CASE WHEN fx_dw004_loc_stat IN ('G', 'N') THEN p9_dw004_loc_acct END) AS active_accounts
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt = @snapshotDate
  `;

  const [dpdRows, summaryRows] = await Promise.all([
    runQuery<DpdRow>(dpdSql, { snapshotDate }, env),
    runQuery<SummaryRow>(summarySql, { snapshotDate }, env),
  ]);

  return { dpdRows, summary: summaryRows[0] ?? { total_accounts: 0, active_accounts: 0 } };
}

// ---------------------------------------------------------------------------
// KPI computation
// ---------------------------------------------------------------------------

function lastRow<T>(rows: T[]): T | undefined {
  return rows[rows.length - 1];
}

function prevRow<T>(rows: T[]): T | undefined {
  return rows.length >= 2 ? rows[rows.length - 2] : undefined;
}

function buildKpi(
  metric: string,
  label: string,
  value: number,
  prevValue: number | null,
  unit: KpiMetric["unit"],
): KpiMetric {
  const changePercent =
    prevValue != null && prevValue !== 0
      ? Math.round(((value - prevValue) / Math.abs(prevValue)) * 10000) / 100
      : null;
  const direction: KpiMetric["direction"] =
    changePercent === null || changePercent === 0
      ? "flat"
      : changePercent > 0
        ? "up"
        : "down";
  return { metric, label, value, prevValue, unit, changePercent, direction };
}

async function computeKpis(env: Env) {
  const { start, end } = getLastFullWeek();
  // Go back 12 weeks for chart data
  const extended = getExtendedRange(end, 12);
  const startDate = toSqlDate(extended.start);
  const endDate = toSqlDate(end);
  const snapshotDate = toSqlDate(end);

  // Run all queries in parallel
  const [eligibleRows, spendRows, decisionRows, portfolio] = await Promise.all([
    getEligibleAndTransactors(startDate, endDate, env),
    getSpendMetrics(startDate, endDate, env),
    getDecisionFunnel(startDate, endDate, env),
    getPortfolioSnapshot(snapshotDate, env),
  ]);

  // Build KPI metrics
  const kpis: KpiMetric[] = [];

  // 1. Eligible accounts
  const latestEligible = lastRow(eligibleRows);
  const prevEligible = prevRow(eligibleRows);
  kpis.push(
    buildKpi(
      "eligible_count",
      "Eligible Accounts",
      latestEligible?.eligible_count ?? 0,
      prevEligible?.eligible_count ?? null,
      "count",
    ),
  );

  // 2. Spend Active Rate
  kpis.push(
    buildKpi(
      "spend_active_rate",
      "Spend Active Rate",
      latestEligible?.spend_active_rate ?? 0,
      prevEligible?.spend_active_rate ?? null,
      "percent",
    ),
  );

  // 3. Total Spend
  const latestSpend = lastRow(spendRows);
  const prevSpend = prevRow(spendRows);
  kpis.push(
    buildKpi(
      "total_spend",
      "Total Spend",
      latestSpend?.total_spend_idr ?? 0,
      prevSpend?.total_spend_idr ?? null,
      "idr",
    ),
  );

  // 4. Delinquency Rate (DPD 30+)
  const totalAccounts = portfolio.summary.total_accounts || 1;
  const dpd30Plus = portfolio.dpdRows
    .filter((r) => r.label !== "Current" && r.label !== "1-30 DPD")
    .reduce((sum, r) => sum + r.count, 0);
  const delinquentRate = Math.round((dpd30Plus / totalAccounts) * 10000) / 100;
  kpis.push(
    buildKpi("total_delinquent_rate", "DPD 30+ Rate", delinquentRate, null, "percent"),
  );

  // 5. Approval Rate
  const latestDecision = lastRow(decisionRows);
  const prevDecision = prevRow(decisionRows);
  kpis.push(
    buildKpi(
      "approval_rate",
      "Approval Rate",
      latestDecision?.approval_rate_pct ?? 0,
      prevDecision?.approval_rate_pct ?? null,
      "percent",
    ),
  );

  // Build chart data
  const chartData: Record<string, unknown> = {
    eligible: eligibleRows.map((r) => ({
      date: r.week_start,
      eligible: r.eligible_count,
      transactors: r.transactor_count,
      rate: r.spend_active_rate,
    })),
    spend: spendRows.map((r) => ({
      date: r.week_start,
      total: r.total_spend_idr,
      online: r.avg_spend_online_idr,
      offline: r.avg_spend_offline_idr,
      qris: r.avg_spend_qris_idr,
    })),
    decisions: decisionRows.map((r) => ({
      date: r.week_start,
      approved: r.approved,
      declined: r.declined,
      waitlisted: r.waitlisted,
      rate: r.approval_rate_pct,
    })),
    portfolio: {
      dpdBuckets: portfolio.dpdRows,
      totalAccounts: portfolio.summary.total_accounts,
      activeAccounts: portfolio.summary.active_accounts,
    },
  };

  // Generate trend descriptions
  const trends: string[] = [];
  if (latestEligible && prevEligible) {
    const change = latestEligible.eligible_count - prevEligible.eligible_count;
    if (change > 0) trends.push(`Eligible accounts grew by ${change.toLocaleString()} this week`);
    else if (change < 0) trends.push(`Eligible accounts decreased by ${Math.abs(change).toLocaleString()} this week`);
  }
  if (latestEligible && latestEligible.spend_active_rate > 0) {
    trends.push(`${latestEligible.spend_active_rate.toFixed(1)}% of eligible accounts made a transaction`);
  }

  return {
    kpis,
    chartData,
    trends,
    asOf: new Date().toISOString(),
    dataRange: { start: toSqlDate(start), end: toSqlDate(end) },
  };
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

interface FnContext {
  request: Request;
  env: Env;
}

export async function onRequest(context: FnContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const cycle = url.searchParams.get("cycle") || "weekly";
  const forceRefresh = request.method === "POST";

  try {
    const key = cacheKey("kpis", cycle, "latest");

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCached<unknown>(key, env.KPI_CACHE);
      if (cached) {
        return new Response(JSON.stringify(cached.data), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
            "X-Cache": cached.fresh ? "HIT-FRESH" : "HIT",
          },
        });
      }
    }

    // Query BigQuery
    const result = await computeKpis(env);

    // Cache the result
    await setCached(key, result, env.KPI_CACHE, 3600);

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("KPI query error:", error);
    const hasRefresh = !!(env.GCP_REFRESH_TOKEN && env.GCP_CLIENT_ID && env.GCP_CLIENT_SECRET);
    const hasSA = !!(env.GCP_SERVICE_ACCOUNT_EMAIL && env.GCP_PRIVATE_KEY);
    const hasToken = !!env.GCP_ACCESS_TOKEN;
    return new Response(
      JSON.stringify({
        error: "Failed to fetch KPI data",
        message: error instanceof Error ? error.message : "Unknown error",
        authMethod: hasRefresh ? "refresh_token" : hasSA ? "service_account" : hasToken ? "access_token" : "none",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
