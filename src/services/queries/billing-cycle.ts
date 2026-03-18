import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Billing Cycle Deep Dive — BigQuery Queries
//
// Honest has two billing cycles based on statement due date:
//   - Cycle 4th: statement due on the 4th of each month (~61% of accounts)
//   - Cycle 26th: statement due on the 26th of each month (~38% of accounts)
//
// All amounts in DW004 are stored in cents (÷ 100 for IDR).
// Active accounts: fx_dw004_loc_stat IN ('G', 'N')
// ---------------------------------------------------------------------------

export interface CycleOverviewRow {
  cycle_day: number | null;
  total_accounts: number;
  with_balance: number;
  revolving: number;
  revolve_rate: number;
  avg_utilization: number;
  avg_balance_idr: number;
  avg_limit_idr: number;
  avg_dpd: number;
}

export interface CycleRevolveTrendRow {
  month: string;
  cycle_day: number;
  revolve_rate: number;
  total_active: number;
  revolving: number;
}

export interface CycleUtilizationBucketRow {
  cycle_day: number;
  bucket: string;
  accounts: number;
  pct: number;
}

export interface CycleDpdBucketRow {
  cycle_day: number;
  bucket: string;
  accounts: number;
  pct: number;
}

export interface CycleBalanceTrendRow {
  month: string;
  cycle_day: number;
  avg_balance_idr: number;
  avg_limit_idr: number;
  total_balance_idr: number;
}

export interface CyclePaymentBehaviorRow {
  cycle_day: number;
  behavior: string;
  accounts: number;
  pct: number;
}

// ---------------------------------------------------------------------------
// 1. Cycle Overview — snapshot for a given business date
// ---------------------------------------------------------------------------

export async function getCycleOverview(busDate: Date): Promise<CycleOverviewRow[]> {
  const sql = `
    SELECT
      EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
      COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts,
      COUNTIF(f9_dw004_clo_bal > 0) AS with_balance,
      COUNTIF(f9_dw004_clo_bal > 0 AND f9_dw004_curr_min_rpmt > 0) AS revolving,
      ROUND(SAFE_DIVIDE(
        COUNTIF(f9_dw004_clo_bal > 0 AND f9_dw004_curr_min_rpmt > 0),
        COUNTIF(f9_dw004_clo_bal > 0)
      ) * 100, 2) AS revolve_rate,
      ROUND(AVG(CASE
        WHEN f9_dw004_loc_lmt > 0 AND f9_dw004_clo_bal > 0
        THEN LEAST(f9_dw004_clo_bal * 100.0 / f9_dw004_loc_lmt, 200)
      END), 2) AS avg_utilization,
      ROUND(AVG(CASE WHEN f9_dw004_clo_bal > 0 THEN f9_dw004_clo_bal / 100.0 END), 0) AS avg_balance_idr,
      ROUND(AVG(CASE WHEN f9_dw004_loc_lmt > 0 THEN f9_dw004_loc_lmt / 100.0 END), 0) AS avg_limit_idr,
      ROUND(AVG(CASE WHEN f9_dw004_curr_dpd > 0 THEN f9_dw004_curr_dpd END), 1) AS avg_dpd
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt = @busDate
      AND fx_dw004_loc_stat IN ('G', 'N')
      AND f9_dw004_stmt_due_dt IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  `;
  return runQuery<CycleOverviewRow>(sql, { busDate: toSqlDate(busDate) });
}

// ---------------------------------------------------------------------------
// 2. Revolve Rate Trend — monthly, by cycle day
// ---------------------------------------------------------------------------

export async function getCycleRevolveTrend(
  startDate: Date,
  endDate: Date,
): Promise<CycleRevolveTrendRow[]> {
  const sql = `
    WITH monthly AS (
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
        EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
        p9_dw004_loc_acct,
        -- Use the last snapshot of each month per account
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn,
        f9_dw004_clo_bal,
        f9_dw004_curr_min_rpmt
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND fx_dw004_loc_stat IN ('G', 'N')
        AND f9_dw004_stmt_due_dt IS NOT NULL
    )
    SELECT
      month,
      cycle_day,
      ROUND(SAFE_DIVIDE(
        COUNTIF(f9_dw004_clo_bal > 0 AND f9_dw004_curr_min_rpmt > 0),
        COUNTIF(f9_dw004_clo_bal > 0)
      ) * 100, 2) AS revolve_rate,
      COUNT(*) AS total_active,
      COUNTIF(f9_dw004_clo_bal > 0 AND f9_dw004_curr_min_rpmt > 0) AS revolving
    FROM monthly
    WHERE rn = 1
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;
  return runQuery<CycleRevolveTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 3. Utilization Distribution — buckets by cycle day
// ---------------------------------------------------------------------------

export async function getCycleUtilizationDistribution(
  busDate: Date,
): Promise<CycleUtilizationBucketRow[]> {
  const sql = `
    WITH util AS (
      SELECT
        EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
        CASE
          WHEN f9_dw004_loc_lmt <= 0 OR f9_dw004_clo_bal <= 0 THEN 'No Balance'
          WHEN f9_dw004_clo_bal * 100.0 / f9_dw004_loc_lmt <= 25 THEN '0-25%'
          WHEN f9_dw004_clo_bal * 100.0 / f9_dw004_loc_lmt <= 50 THEN '25-50%'
          WHEN f9_dw004_clo_bal * 100.0 / f9_dw004_loc_lmt <= 75 THEN '50-75%'
          WHEN f9_dw004_clo_bal * 100.0 / f9_dw004_loc_lmt <= 100 THEN '75-100%'
          ELSE '>100%'
        END AS bucket
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt = @busDate
        AND fx_dw004_loc_stat IN ('G', 'N')
        AND f9_dw004_stmt_due_dt IS NOT NULL
    )
    SELECT
      cycle_day,
      bucket,
      COUNT(*) AS accounts,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY cycle_day), 2) AS pct
    FROM util
    GROUP BY 1, 2
    ORDER BY 1, CASE bucket
      WHEN 'No Balance' THEN 0 WHEN '0-25%' THEN 1 WHEN '25-50%' THEN 2
      WHEN '50-75%' THEN 3 WHEN '75-100%' THEN 4 WHEN '>100%' THEN 5
    END
  `;
  return runQuery<CycleUtilizationBucketRow>(sql, { busDate: toSqlDate(busDate) });
}

// ---------------------------------------------------------------------------
// 4. DPD Distribution — buckets by cycle day
// ---------------------------------------------------------------------------

export async function getCycleDpdDistribution(
  busDate: Date,
): Promise<CycleDpdBucketRow[]> {
  const sql = `
    WITH dpd AS (
      SELECT
        EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
        CASE
          WHEN f9_dw004_curr_dpd = 0 THEN 'Current'
          WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30 DPD'
          WHEN f9_dw004_curr_dpd BETWEEN 31 AND 60 THEN '31-60 DPD'
          WHEN f9_dw004_curr_dpd BETWEEN 61 AND 90 THEN '61-90 DPD'
          ELSE '90+ DPD'
        END AS bucket
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt = @busDate
        AND fx_dw004_loc_stat IN ('G', 'N')
        AND f9_dw004_stmt_due_dt IS NOT NULL
    )
    SELECT
      cycle_day,
      bucket,
      COUNT(*) AS accounts,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY cycle_day), 2) AS pct
    FROM dpd
    GROUP BY 1, 2
    ORDER BY 1, CASE bucket
      WHEN 'Current' THEN 0 WHEN '1-30 DPD' THEN 1 WHEN '31-60 DPD' THEN 2
      WHEN '61-90 DPD' THEN 3 WHEN '90+ DPD' THEN 4
    END
  `;
  return runQuery<CycleDpdBucketRow>(sql, { busDate: toSqlDate(busDate) });
}

// ---------------------------------------------------------------------------
// 5. Balance Trend — monthly average balance by cycle day
// ---------------------------------------------------------------------------

export async function getCycleBalanceTrend(
  startDate: Date,
  endDate: Date,
): Promise<CycleBalanceTrendRow[]> {
  const sql = `
    WITH monthly AS (
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
        EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
        p9_dw004_loc_acct,
        f9_dw004_clo_bal,
        f9_dw004_loc_lmt,
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND fx_dw004_loc_stat IN ('G', 'N')
        AND f9_dw004_stmt_due_dt IS NOT NULL
        AND f9_dw004_clo_bal > 0
    )
    SELECT
      month,
      cycle_day,
      ROUND(AVG(f9_dw004_clo_bal / 100.0), 0) AS avg_balance_idr,
      ROUND(AVG(f9_dw004_loc_lmt / 100.0), 0) AS avg_limit_idr,
      ROUND(SUM(f9_dw004_clo_bal / 100.0), 0) AS total_balance_idr
    FROM monthly
    WHERE rn = 1
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;
  return runQuery<CycleBalanceTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 6. Payment Behavior — paid in full vs min vs partial vs no payment
// ---------------------------------------------------------------------------

export async function getCyclePaymentBehavior(
  busDate: Date,
): Promise<CyclePaymentBehaviorRow[]> {
  const sql = `
    WITH behavior AS (
      SELECT
        EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
        CASE
          WHEN f9_dw004_clo_bal <= 0 THEN 'Paid in Full'
          WHEN f9_dw004_curr_min_rpmt <= 0 AND f9_dw004_clo_bal > 0 THEN 'Below Min Due'
          WHEN f9_dw004_curr_min_rpmt > 0 AND f9_dw004_curr_dpd = 0 THEN 'Min Payment Made'
          WHEN f9_dw004_curr_dpd > 0 THEN 'Past Due'
          ELSE 'Other'
        END AS behavior
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt = @busDate
        AND fx_dw004_loc_stat IN ('G', 'N')
        AND f9_dw004_stmt_due_dt IS NOT NULL
    )
    SELECT
      cycle_day,
      behavior,
      COUNT(*) AS accounts,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY cycle_day), 2) AS pct
    FROM behavior
    GROUP BY 1, 2
    ORDER BY 1, CASE behavior
      WHEN 'Paid in Full' THEN 0 WHEN 'Min Payment Made' THEN 1
      WHEN 'Below Min Due' THEN 2 WHEN 'Past Due' THEN 3 WHEN 'Other' THEN 4
    END
  `;
  return runQuery<CyclePaymentBehaviorRow>(sql, { busDate: toSqlDate(busDate) });
}
