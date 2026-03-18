import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DelinquencyRateRow {
  month: string;
  dpd_30_plus_rate: number;
  dpd_60_plus_rate: number;
  dpd_90_plus_rate: number;
}

export interface DpdFlowRateRow {
  month: string;
  from_bucket: string;
  to_bucket: string;
  count: number;
}

export interface DpdBalanceExposureRow {
  dpd_bucket: string;
  accounts: number;
  balance: number;
  pct_of_total: number;
}

export interface WriteOffTrendRow {
  month: string;
  writeoff_count: number;
  writeoff_balance: number;
}

export interface CollectionsStatusRow {
  coll_status: string;
  accounts: number;
  balance: number;
}

// ---------------------------------------------------------------------------
// 1. Delinquency Rate Trend (monthly)
// ---------------------------------------------------------------------------

export async function getDelinquencyRateTrend(
  startDate: Date,
  endDate: Date,
): Promise<DelinquencyRateRow[]> {
  const sql = `
    WITH monthly_snapshot AS (
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
        p9_dw004_loc_acct,
        fx_dw004_loc_stat,
        f9_dw004_curr_dpd,
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND fx_dw004_loc_stat IN ('G', 'N')
    ),
    snapshot AS (
      SELECT * FROM monthly_snapshot WHERE rn = 1
    )
    SELECT
      month,
      ROUND(COUNTIF(f9_dw004_curr_dpd > 30) * 100.0 / COUNT(*), 2) AS dpd_30_plus_rate,
      ROUND(COUNTIF(f9_dw004_curr_dpd > 60) * 100.0 / COUNT(*), 2) AS dpd_60_plus_rate,
      ROUND(COUNTIF(f9_dw004_curr_dpd > 90) * 100.0 / COUNT(*), 2) AS dpd_90_plus_rate
    FROM snapshot
    GROUP BY month
    ORDER BY month
  `;

  return runQuery<DelinquencyRateRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. DPD Flow Rates (roll rate matrix, month-over-month)
// ---------------------------------------------------------------------------

export async function getDpdFlowRates(
  startDate: Date,
  endDate: Date,
): Promise<DpdFlowRateRow[]> {
  const sql = `
    WITH monthly_snapshot AS (
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
        p9_dw004_loc_acct,
        f9_dw004_curr_dpd,
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND fx_dw004_loc_stat IN ('G', 'N')
    ),
    snapshot AS (
      SELECT * FROM monthly_snapshot WHERE rn = 1
    ),
    bucketed AS (
      SELECT
        month,
        p9_dw004_loc_acct,
        CASE
          WHEN f9_dw004_curr_dpd = 0 THEN 'Current'
          WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30'
          WHEN f9_dw004_curr_dpd BETWEEN 31 AND 60 THEN '31-60'
          WHEN f9_dw004_curr_dpd BETWEEN 61 AND 90 THEN '61-90'
          ELSE '90+'
        END AS dpd_bucket
      FROM snapshot
    ),
    transitions AS (
      SELECT
        curr.month,
        prev.dpd_bucket AS from_bucket,
        curr.dpd_bucket AS to_bucket,
        COUNT(*) AS count
      FROM bucketed curr
      JOIN bucketed prev
        ON curr.p9_dw004_loc_acct = prev.p9_dw004_loc_acct
        AND prev.month = FORMAT_DATE('%Y-%m', DATE_SUB(PARSE_DATE('%Y-%m', curr.month), INTERVAL 1 MONTH))
      GROUP BY curr.month, from_bucket, to_bucket
    )
    SELECT month, from_bucket, to_bucket, count
    FROM transitions
    ORDER BY month, from_bucket, to_bucket
  `;

  return runQuery<DpdFlowRateRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 3. DPD Balance Exposure (point-in-time snapshot)
// ---------------------------------------------------------------------------

export async function getDpdBalanceExposure(
  busDate: Date,
): Promise<DpdBalanceExposureRow[]> {
  const sql = `
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt <= @busDate
        AND fx_dw004_loc_stat IN ('G', 'N')
    ),
    snapshot AS (
      SELECT * FROM ranked WHERE rn = 1
    ),
    bucketed AS (
      SELECT
        CASE
          WHEN f9_dw004_curr_dpd = 0 THEN 'Current'
          WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30'
          WHEN f9_dw004_curr_dpd BETWEEN 31 AND 60 THEN '31-60'
          WHEN f9_dw004_curr_dpd BETWEEN 61 AND 90 THEN '61-90'
          ELSE '90+'
        END AS dpd_bucket,
        COUNT(*) AS accounts,
        ROUND(SUM(f9_dw004_clo_bal / 100), 0) AS balance
      FROM snapshot
      GROUP BY dpd_bucket
    ),
    total AS (
      SELECT SUM(balance) AS total_balance FROM bucketed
    )
    SELECT
      b.dpd_bucket,
      b.accounts,
      b.balance,
      ROUND(b.balance * 100.0 / NULLIF(t.total_balance, 0), 2) AS pct_of_total
    FROM bucketed b
    CROSS JOIN total t
    ORDER BY
      CASE b.dpd_bucket
        WHEN 'Current' THEN 1
        WHEN '1-30' THEN 2
        WHEN '31-60' THEN 3
        WHEN '61-90' THEN 4
        ELSE 5
      END
  `;

  return runQuery<DpdBalanceExposureRow>(sql, { busDate: toSqlDate(busDate) });
}

// ---------------------------------------------------------------------------
// 4. Write-Off Trend (monthly)
// ---------------------------------------------------------------------------

export async function getWriteOffTrend(
  startDate: Date,
  endDate: Date,
): Promise<WriteOffTrendRow[]> {
  const sql = `
    WITH monthly_snapshot AS (
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
        p9_dw004_loc_acct,
        fx_dw004_loc_stat,
        f9_dw004_clo_bal,
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND fx_dw004_loc_stat = 'W'
    ),
    snapshot AS (
      SELECT * FROM monthly_snapshot WHERE rn = 1
    )
    SELECT
      month,
      COUNT(*) AS writeoff_count,
      ROUND(SUM(f9_dw004_clo_bal / 100), 0) AS writeoff_balance
    FROM snapshot
    GROUP BY month
    ORDER BY month
  `;

  return runQuery<WriteOffTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 5. Collections Status Breakdown (point-in-time snapshot)
// ---------------------------------------------------------------------------

export async function getCollectionsStatusBreakdown(
  busDate: Date,
): Promise<CollectionsStatusRow[]> {
  const sql = `
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt <= @busDate
        AND fx_dw004_loc_stat IN ('G', 'N')
        AND f9_dw004_curr_dpd > 0
    ),
    snapshot AS (
      SELECT * FROM ranked WHERE rn = 1
    )
    SELECT
      COALESCE(NULLIF(TRIM(fx_dw004_coll_stat_cde), ''), 'None') AS coll_status,
      COUNT(*) AS accounts,
      ROUND(SUM(f9_dw004_clo_bal / 100), 0) AS balance
    FROM snapshot
    GROUP BY coll_status
    ORDER BY accounts DESC
  `;

  return runQuery<CollectionsStatusRow>(sql, { busDate: toSqlDate(busDate) });
}
