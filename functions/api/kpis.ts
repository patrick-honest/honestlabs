/**
 * GET /api/kpis?cycle=weekly
 * POST /api/kpis (force refresh)
 *
 * Returns KPI data for the main dashboard.
 */

import { runQuery, TABLES, toSqlDate, getLastFullWeek, getPriorWeek, getExtendedRange } from "../_shared/bigquery-client";
import { getCached, setCached, cacheKey } from "../_shared/cache";
import type { Env } from "../_shared/bigquery-auth";
import { parseFilters, hasAnyFilter, cardTypeWhere, cycleDateWhere, transactionTypeWhere, amountRangeWhere, productTypeWhere, type ParsedFilters } from "../_shared/filters";

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

async function getEligibleAndTransactors(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  // Cohort-based Spend Active Rate:
  // For each ISOWEEK cohort of users who become first-time eligible, what %
  // transacted within 7 days of their individual first-eligible date.
  // Only includes cohorts where the 7+6-day observation window has fully elapsed.
  const sql = `
    WITH regular_users AS (
      SELECT DISTINCT dc.user_id, loc.external_id AS loc_acct
      FROM ${TABLES.decision_completed} dc
      INNER JOIN ${TABLES.cms_line_of_credit} loc ON dc.user_id = loc.user_id
      WHERE UPPER(dc.decision) = 'APPROVED'
        AND (dc.is_prepaid_card_applicable IS NULL OR dc.is_prepaid_card_applicable = FALSE)
        AND (dc.is_account_opening_fee_applicable IS NULL OR dc.is_account_opening_fee_applicable = FALSE)
    ),
    eligible_check AS (
      SELECT
        dw4.f9_dw004_bus_dt AS eligible_date,
        dw4.p9_dw004_prin_crn AS crn,
        ru.user_id
      FROM ${TABLES.financial_account_updates} dw4
      INNER JOIN regular_users ru ON dw4.p9_dw004_loc_acct = ru.loc_acct
      INNER JOIN ${TABLES.principal_card_updates} dw5
        ON dw4.p9_dw004_loc_acct = dw5.f9_dw005_loc_acct
        AND CAST(DATETIME(dw5.f9_dw005_upd_tms, 'Asia/Jakarta') AS DATE) <= dw4.f9_dw004_bus_dt
      WHERE dw4.fx_dw004_loc_stat IN ('G', 'N')
        AND dw4.f9_dw004_curr_dpd >= 0
        AND TRIM(CAST(dw5.f9_dw005_1st_unblk_all_mtd_tms AS STRING)) != ''
        AND (dw5.fx_dw005_crd_stat IS NULL OR TRIM(CAST(dw5.fx_dw005_crd_stat AS STRING)) != '')
        AND dw5.f9_dw005_hce_txn_ind LIKE '%0%'
        AND dw5.f9_dw005_net_txn_ind LIKE '%0%'
        AND dw5.fx_dw005_contc_less_flg LIKE '%Y%'
        AND dw5.f9_dw005_contc_txn_ind LIKE '%0%'
        ${cardTypeWhere(filters, 'dw5')}
        ${cycleDateWhere(filters, 'dw4')}
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY dw4.p9_dw004_loc_acct, dw4.f9_dw004_bus_dt
        ORDER BY dw5.f9_dw005_upd_tms DESC
      ) = 1
    ),
    first_eligible AS (
      SELECT user_id, crn, MIN(eligible_date) AS first_eligible_date
      FROM eligible_check
      GROUP BY user_id, crn
      QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY MIN(eligible_date)) = 1
    ),
    weekly_cohort AS (
      SELECT
        DATE_TRUNC(first_eligible_date, ISOWEEK) AS week_start,
        user_id, first_eligible_date, crn
      FROM first_eligible
      WHERE first_eligible_date BETWEEN @startDate AND @endDate
        AND DATE_ADD(DATE_TRUNC(first_eligible_date, ISOWEEK), INTERVAL 13 DAY) <= CURRENT_DATE('Asia/Jakarta')
    ),
    transactors AS (
      SELECT DISTINCT wc.user_id, wc.week_start
      FROM weekly_cohort wc
      INNER JOIN ${TABLES.authorized_transaction} t
        ON wc.crn = t.f9_dw007_prin_crn
        AND t.f9_dw007_dt BETWEEN wc.first_eligible_date AND DATE_ADD(wc.first_eligible_date, INTERVAL 7 DAY)
      WHERE (t.fx_dw007_stat IS NULL OR t.fx_dw007_stat = '' OR t.fx_dw007_stat = ' ')
        AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        ${transactionTypeWhere(filters, 't')}
        ${amountRangeWhere(filters, 't')}
    )
    SELECT
      FORMAT_DATE('%Y-%m-%d', wc.week_start + 7) AS week_start,
      COUNT(DISTINCT wc.user_id) AS eligible_count,
      COUNT(DISTINCT tr.user_id) AS transactor_count,
      COUNT(DISTINCT tr.user_id) AS total_transactions,
      ROUND(COUNT(DISTINCT tr.user_id) * 100.0 / COUNT(DISTINCT wc.user_id), 2) AS spend_active_rate
    FROM weekly_cohort wc
    LEFT JOIN transactors tr ON wc.user_id = tr.user_id AND wc.week_start = tr.week_start
    GROUP BY wc.week_start
    ORDER BY wc.week_start
  `;
  return runQuery<EligibleRow>(sql, { startDate, endDate }, env);
}

async function getSpendMetrics(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
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
        ${transactionTypeWhere(filters, 'dw7')}
        ${amountRangeWhere(filters, 'dw7')}
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

async function getDecisionFunnel(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
      COUNT(*) AS total_decisions,
      COUNTIF(decision = 'APPROVED') AS approved,
      COUNTIF(decision = 'DECLINED') AS declined,
      COUNTIF(decision = 'WAITLISTED') AS waitlisted,
      ROUND(SAFE_DIVIDE(COUNTIF(decision = 'APPROVED'), COUNT(*)) * 100, 2) AS approval_rate_pct
    FROM ${TABLES.decision_completed} dc
    WHERE DATE(dc.timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      ${productTypeWhere(filters, 'dc')}
    GROUP BY week_start
    ORDER BY week_start
  `;
  return runQuery<DecisionRow>(sql, { startDate, endDate }, env);
}

async function getPortfolioSnapshot(snapshotDate: string, env: Env, filters: ParsedFilters) {
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
    FROM ${TABLES.financial_account_updates} dw4
    WHERE dw4.f9_dw004_bus_dt = @snapshotDate
      AND dw4.f9_dw004_curr_dpd >= 0
      ${cycleDateWhere(filters, 'dw4')}
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
    FROM ${TABLES.financial_account_updates} dw4
    WHERE dw4.f9_dw004_bus_dt = @snapshotDate
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

async function computeKpis(env: Env, filters: ParsedFilters, urlStartDate?: string, urlEndDate?: string, period = "monthly") {
  const { start, end } = getLastFullWeek();
  const endDate = urlEndDate || toSqlDate(end);
  const snapshotDate = urlEndDate || toSqlDate(end);

  // Extend start date to include 6 periods of chart context
  let startDate: string;
  if (urlStartDate) {
    const d = new Date(urlStartDate + "T00:00:00Z");
    switch (period) {
      case "weekly": d.setUTCDate(d.getUTCDate() - 6 * 7); break;
      case "monthly": d.setUTCMonth(d.getUTCMonth() - 6); break;
      case "quarterly": d.setUTCMonth(d.getUTCMonth() - 18); break;
      default: d.setUTCMonth(d.getUTCMonth() - 6); break;
    }
    startDate = d.toISOString().slice(0, 10);
  } else {
    const extended = getExtendedRange(end, 12);
    startDate = toSqlDate(extended.start);
  }

  // Run all queries in parallel
  const [eligibleRows, spendRows, decisionRows, portfolio] = await Promise.all([
    getEligibleAndTransactors(startDate, endDate, env, filters),
    getSpendMetrics(startDate, endDate, env, filters),
    getDecisionFunnel(startDate, endDate, env, filters),
    getPortfolioSnapshot(snapshotDate, env, filters),
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
  const forceRefresh = request.method === "POST";
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  const period = url.searchParams.get("period") || "monthly";
  const filters = parseFilters(url);
  const hasFilters = hasAnyFilter(filters);

  try {
    const filterKey = hasFilters
      ? Object.entries(filters)
          .filter(([, v]) => v.length > 0)
          .map(([k, v]) => `${k}=${v.sort().join("+")}`)
          .join("&")
      : "";
    const key = cacheKey("kpis", startDate || "auto", `${endDate || "auto"}:${filterKey}`);

    // Check cache first (unless force refresh or filtered)
    if (!forceRefresh && !hasFilters) {
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

    // Query BigQuery with filters and date params
    const result = await computeKpis(env, filters, startDate, endDate, period);

    // Cache unfiltered results only
    if (!hasFilters) {
      await setCached(key, result, env.KPI_CACHE, 3600);
    }

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
