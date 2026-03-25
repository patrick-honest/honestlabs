import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepaymentVolumeTrendRow {
  month: string;
  count: number;
  total_amount_idr: number;
}

export interface RepaymentByVendorRow {
  vendor: string;
  count: number;
  amount: number;
}

export interface RepaymentTimelinessBucketRow {
  bucket: string;
  accounts: number;
  pct: number;
}

export interface RepaymentToBalanceRatioRow {
  month: string;
  avg_ratio: number;
}

export interface WeeklyRepaymentTrendRow {
  week_start: string;
  payment_count: number;
  total_amount_idr: number;
  unique_accounts: number;
}

// ---------------------------------------------------------------------------
// 0. Weekly Repayment Trend (from DW009 posted_transaction)
// ---------------------------------------------------------------------------

export async function getWeeklyRepaymentTrend(
  startDate: Date,
  endDate: Date,
): Promise<WeeklyRepaymentTrendRow[]> {
  const sql = `
    SELECT
      DATE_TRUNC(p9_dw009_pst_dt, ISOWEEK) AS week_start,
      COUNT(*) AS payment_count,
      ROUND(SUM(CAST(f9_dw009_amt AS FLOAT64) / 100), 2) AS total_amount_idr,
      COUNT(DISTINCT fx_dw009_loc_acct) AS unique_accounts
    FROM ${TABLES.posted_transaction}
    WHERE p9_dw009_pst_dt BETWEEN @startDate AND @endDate
      AND fx_dw009_txn_typ IN ('PM', 'RF')
    GROUP BY week_start
    ORDER BY week_start
  `;

  return runQuery<WeeklyRepaymentTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 1. Repayment Volume Trend (monthly, from DW009 posted_transaction)
// ---------------------------------------------------------------------------

export async function getRepaymentVolumeTrend(
  startDate: Date,
  endDate: Date,
): Promise<RepaymentVolumeTrendRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m', f9_dw009_dt) AS month,
      COUNT(*) AS count,
      ROUND(SUM(f9_dw009_amt / 100), 0) AS total_amount_idr
    FROM ${TABLES.posted_transaction}
    WHERE f9_dw009_dt BETWEEN @startDate AND @endDate
      AND fx_dw009_txn_typ = 'PM'
    GROUP BY month
    ORDER BY month
  `;

  return runQuery<RepaymentVolumeTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Repayment by Vendor (from Rudderstack repayment_completed)
// ---------------------------------------------------------------------------

export async function getRepaymentByVendor(
  startDate: Date,
  endDate: Date,
): Promise<RepaymentByVendorRow[]> {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(vendor), ''), 'Unknown') AS vendor,
      COUNT(*) AS count,
      ROUND(SUM(SAFE_CAST(amount AS FLOAT64)), 0) AS amount
    FROM ${TABLES.repayment_completed}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY vendor
    ORDER BY count DESC
  `;

  return runQuery<RepaymentByVendorRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 3. Repayment Timeliness (DPD bucket snapshot from DW004)
//    Uses a single business date (latest in range) to get current DPD state
// ---------------------------------------------------------------------------

export async function getRepaymentTimeliness(
  busDate: Date,
): Promise<RepaymentTimelinessBucketRow[]> {
  const sql = `
    WITH latest AS (
      SELECT
        p9_dw004_loc_acct,
        f9_dw004_curr_dpd,
        ROW_NUMBER() OVER (PARTITION BY p9_dw004_loc_acct ORDER BY f9_dw004_bus_dt DESC) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt <= @busDate
        AND fx_dw004_loc_stat = 'A'
    ),
    bucketed AS (
      SELECT
        CASE
          WHEN f9_dw004_curr_dpd = 0 OR f9_dw004_curr_dpd IS NULL THEN 'On-time'
          WHEN f9_dw004_curr_dpd BETWEEN 1 AND 7 THEN '1-7 late'
          WHEN f9_dw004_curr_dpd BETWEEN 8 AND 30 THEN '8-30 late'
          ELSE '30+ late'
        END AS bucket,
        p9_dw004_loc_acct
      FROM latest
      WHERE rn = 1
    ),
    counts AS (
      SELECT bucket, COUNT(DISTINCT p9_dw004_loc_acct) AS accounts
      FROM bucketed
      GROUP BY bucket
    ),
    total AS (
      SELECT SUM(accounts) AS total_accounts FROM counts
    )
    SELECT
      c.bucket,
      c.accounts,
      ROUND(SAFE_DIVIDE(c.accounts, t.total_accounts) * 100, 2) AS pct
    FROM counts c
    CROSS JOIN total t
    ORDER BY
      CASE c.bucket
        WHEN 'On-time' THEN 1
        WHEN '1-7 late' THEN 2
        WHEN '8-30 late' THEN 3
        WHEN '30+ late' THEN 4
      END
  `;

  return runQuery<RepaymentTimelinessBucketRow>(sql, {
    busDate: toSqlDate(busDate),
  });
}

// ---------------------------------------------------------------------------
// 4. Repayment-to-Balance Ratio (monthly avg from DW009 + DW004)
// ---------------------------------------------------------------------------

export async function getRepaymentToBalanceRatio(
  startDate: Date,
  endDate: Date,
): Promise<RepaymentToBalanceRatioRow[]> {
  const sql = `
    WITH monthly_payments AS (
      SELECT
        fx_dw009_loc_acct AS loc_acct,
        FORMAT_DATE('%Y-%m', f9_dw009_dt) AS month,
        SUM(f9_dw009_amt / 100) AS paid_amount
      FROM ${TABLES.posted_transaction}
      WHERE f9_dw009_dt BETWEEN @startDate AND @endDate
        AND fx_dw009_txn_typ = 'PM'
      GROUP BY loc_acct, month
    ),
    monthly_balance AS (
      SELECT
        p9_dw004_loc_acct AS loc_acct,
        FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
        AVG(f9_dw004_clo_bal / 100) AS avg_balance
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND fx_dw004_loc_stat = 'A'
        AND f9_dw004_clo_bal > 0
      GROUP BY loc_acct, month
    )
    SELECT
      b.month,
      ROUND(AVG(SAFE_DIVIDE(COALESCE(p.paid_amount, 0), b.avg_balance)) * 100, 2) AS avg_ratio
    FROM monthly_balance b
    LEFT JOIN monthly_payments p
      ON b.loc_acct = p.loc_acct AND b.month = p.month
    GROUP BY b.month
    ORDER BY b.month
  `;

  return runQuery<RepaymentToBalanceRatioRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
