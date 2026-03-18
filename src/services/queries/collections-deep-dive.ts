import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CollectionsActivityTrendRow {
  month: string;
  activities: number;
  unique_accounts: number;
}

export interface CollectionsStatusBreakdownRow {
  coll_stat_code: string;
  accounts: number;
  balance: number;
}

export interface DpdCureRateRow {
  month: string;
  cured_accounts: number;
  total_delinquent: number;
  cure_rate: number;
}

export interface WriteOffTrendRow {
  month: string;
  writeoff_count: number;
  writeoff_balance: number;
}

// ---------------------------------------------------------------------------
// 1. Collections Activity Trend (monthly, from regular_activity)
// ---------------------------------------------------------------------------

export async function getCollectionsActivityTrend(
  startDate: Date,
  endDate: Date,
): Promise<CollectionsActivityTrendRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m', activity_date) AS month,
      COUNT(*) AS activities,
      COUNT(DISTINCT account_number) AS unique_accounts
    FROM ${TABLES.regular_activity}
    WHERE activity_date BETWEEN @startDate AND @endDate
    GROUP BY month
    ORDER BY month
  `;

  return runQuery<CollectionsActivityTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Collections Status Breakdown (snapshot from DW004)
//    Uses fx_dw004_coll_stat_cde for collection status codes
// ---------------------------------------------------------------------------

export async function getCollectionsStatusBreakdown(
  busDate: Date,
): Promise<CollectionsStatusBreakdownRow[]> {
  const sql = `
    WITH latest AS (
      SELECT
        p9_dw004_loc_acct,
        fx_dw004_coll_stat_cde,
        f9_dw004_clo_bal,
        ROW_NUMBER() OVER (PARTITION BY p9_dw004_loc_acct ORDER BY f9_dw004_bus_dt DESC) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt <= @busDate
        AND fx_dw004_loc_stat = 'A'
        AND f9_dw004_curr_dpd > 0
    )
    SELECT
      COALESCE(NULLIF(TRIM(fx_dw004_coll_stat_cde), ''), 'None') AS coll_stat_code,
      COUNT(DISTINCT p9_dw004_loc_acct) AS accounts,
      ROUND(SUM(f9_dw004_clo_bal / 100), 0) AS balance
    FROM latest
    WHERE rn = 1
    GROUP BY coll_stat_code
    ORDER BY accounts DESC
  `;

  return runQuery<CollectionsStatusBreakdownRow>(sql, {
    busDate: toSqlDate(busDate),
  });
}

// ---------------------------------------------------------------------------
// 3. DPD Cure Rate (monthly — accounts that went from DPD>0 to DPD=0)
// ---------------------------------------------------------------------------

export async function getDpdCureRate(
  startDate: Date,
  endDate: Date,
): Promise<DpdCureRateRow[]> {
  const sql = `
    WITH monthly_dpd AS (
      SELECT
        p9_dw004_loc_acct,
        FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
        MAX(f9_dw004_curr_dpd) AS max_dpd,
        MIN(f9_dw004_curr_dpd) AS min_dpd
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND fx_dw004_loc_stat = 'A'
      GROUP BY p9_dw004_loc_acct, month
    ),
    delinquent AS (
      SELECT
        month,
        COUNT(DISTINCT p9_dw004_loc_acct) AS total_delinquent,
        COUNT(DISTINCT CASE WHEN min_dpd = 0 AND max_dpd > 0 THEN p9_dw004_loc_acct END) AS cured_accounts
      FROM monthly_dpd
      WHERE max_dpd > 0
      GROUP BY month
    )
    SELECT
      month,
      cured_accounts,
      total_delinquent,
      ROUND(SAFE_DIVIDE(cured_accounts, total_delinquent) * 100, 2) AS cure_rate
    FROM delinquent
    ORDER BY month
  `;

  return runQuery<DpdCureRateRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 4. Write-Off Trend (monthly, from DW004 — accounts moving to write-off status)
// ---------------------------------------------------------------------------

export async function getWriteOffTrend(
  startDate: Date,
  endDate: Date,
): Promise<WriteOffTrendRow[]> {
  const sql = `
    WITH writeoffs AS (
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
        p9_dw004_loc_acct,
        f9_dw004_clo_bal
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND fx_dw004_loc_stat = 'W'
    )
    SELECT
      month,
      COUNT(DISTINCT p9_dw004_loc_acct) AS writeoff_count,
      ROUND(SUM(f9_dw004_clo_bal / 100), 0) AS writeoff_balance
    FROM writeoffs
    GROUP BY month
    ORDER BY month
  `;

  return runQuery<WriteOffTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
