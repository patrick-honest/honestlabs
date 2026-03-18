import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeeklyDpdDistributionRow {
  week_start: string;
  current_count: number;
  dpd_1_30: number;
  dpd_31_60: number;
  dpd_61_90: number;
  dpd_90_plus: number;
  total_accounts: number;
  delinquency_rate_30plus: number;
}

export interface DpdBalanceExposureRow {
  bucket: string;
  accounts: number;
  total_balance_idr: number;
}

// ---------------------------------------------------------------------------
// 1. Weekly DPD Distribution — account counts by DPD bucket, weekly
// ---------------------------------------------------------------------------

export async function getWeeklyDpdDistribution(
  startDate: Date,
  endDate: Date,
): Promise<WeeklyDpdDistributionRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(f9_dw004_bus_dt, ISOWEEK)) AS week_start,
      COUNTIF(f9_dw004_curr_dpd = 0) AS current_count,
      COUNTIF(f9_dw004_curr_dpd BETWEEN 1 AND 30) AS dpd_1_30,
      COUNTIF(f9_dw004_curr_dpd BETWEEN 31 AND 60) AS dpd_31_60,
      COUNTIF(f9_dw004_curr_dpd BETWEEN 61 AND 90) AS dpd_61_90,
      COUNTIF(f9_dw004_curr_dpd > 90) AS dpd_90_plus,
      COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts,
      ROUND(SAFE_DIVIDE(COUNTIF(f9_dw004_curr_dpd > 30), COUNT(DISTINCT p9_dw004_loc_acct)) * 100, 2) AS delinquency_rate_30plus
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
      AND EXTRACT(DAYOFWEEK FROM f9_dw004_bus_dt) = 1
      AND fx_dw004_loc_stat IN ('G', 'N', 'D')
    GROUP BY week_start
    ORDER BY week_start
  `;

  return runQuery<WeeklyDpdDistributionRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. DPD Balance Exposure — balance by DPD bucket at latest snapshot
// ---------------------------------------------------------------------------

export async function getDpdBalanceExposure(
  endDate: Date,
): Promise<DpdBalanceExposureRow[]> {
  const sql = `
    SELECT
      CASE
        WHEN f9_dw004_curr_dpd = 0 THEN 'Current'
        WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30 DPD'
        WHEN f9_dw004_curr_dpd BETWEEN 31 AND 60 THEN '31-60 DPD'
        WHEN f9_dw004_curr_dpd BETWEEN 61 AND 90 THEN '61-90 DPD'
        ELSE '90+ DPD'
      END AS bucket,
      COUNT(DISTINCT p9_dw004_loc_acct) AS accounts,
      ROUND(SUM(CAST(f9_dw004_cur_bal AS FLOAT64)), 2) AS total_balance_idr
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt = (
      SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates} WHERE f9_dw004_bus_dt <= @endDate
    )
      AND fx_dw004_loc_stat IN ('G', 'N', 'D')
    GROUP BY bucket
    ORDER BY MIN(f9_dw004_curr_dpd)
  `;

  return runQuery<DpdBalanceExposureRow>(sql, {
    endDate: toSqlDate(endDate),
  });
}
