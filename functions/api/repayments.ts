import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";

async function queryRepayments(startDate: string, endDate: string, env: Env) {
  const [weeklyTrend, byVendor, timeliness] = await Promise.all([
    // Weekly Repayment Trend (from DW009 posted_transaction)
    runQuery(
      `SELECT
        FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(p9_dw009_pst_dt, ISOWEEK)) AS week_start,
        COUNT(*) AS payment_count,
        ROUND(SUM(CAST(f9_dw009_txn_amt AS FLOAT64) / 100), 2) AS total_amount_idr,
        COUNT(DISTINCT fx_dw009_loc_acct) AS unique_accounts
      FROM ${TABLES.posted_transaction}
      WHERE p9_dw009_pst_dt BETWEEN @startDate AND @endDate
        AND f9_dw009_txn_cde LIKE '%PM%'
      GROUP BY week_start
      ORDER BY week_start`,
      { startDate, endDate }, env,
    ),

    // Repayment by Vendor (from Rudderstack repayment_completed)
    runQuery(
      `SELECT
        COALESCE(NULLIF(TRIM(vendor), ''), 'Unknown') AS vendor,
        COUNT(*) AS count,
        ROUND(SUM(SAFE_CAST(repayment_amount AS FLOAT64)), 0) AS amount
      FROM ${TABLES.repayment_completed}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY vendor
      ORDER BY count DESC`,
      { startDate, endDate }, env,
    ),

    // Repayment Timeliness (DPD bucket snapshot from DW004)
    runQuery(
      `WITH latest AS (
        SELECT p9_dw004_loc_acct, f9_dw004_curr_dpd,
          ROW_NUMBER() OVER (PARTITION BY p9_dw004_loc_acct ORDER BY f9_dw004_bus_dt DESC) AS rn
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt <= @endDate AND fx_dw004_loc_stat IN ('G','N')
      ),
      bucketed AS (
        SELECT CASE
          WHEN f9_dw004_curr_dpd = 0 OR f9_dw004_curr_dpd IS NULL THEN 'On-time'
          WHEN f9_dw004_curr_dpd BETWEEN 1 AND 7 THEN '1-7 late'
          WHEN f9_dw004_curr_dpd BETWEEN 8 AND 30 THEN '8-30 late'
          ELSE '30+ late'
        END AS bucket, p9_dw004_loc_acct
        FROM latest WHERE rn = 1
      ),
      counts AS (SELECT bucket, COUNT(DISTINCT p9_dw004_loc_acct) AS accounts FROM bucketed GROUP BY bucket),
      total AS (SELECT SUM(accounts) AS total_accounts FROM counts)
      SELECT c.bucket, c.accounts, ROUND(SAFE_DIVIDE(c.accounts, t.total_accounts)*100,2) AS pct
      FROM counts c CROSS JOIN total t
      ORDER BY CASE c.bucket WHEN 'On-time' THEN 1 WHEN '1-7 late' THEN 2 WHEN '8-30 late' THEN 3 WHEN '30+ late' THEN 4 END`,
      { endDate }, env,
    ),
  ]);

  return { weeklyTrend, byVendor, timeliness };
}

export const onRequest = createHandler({ section: "repayments", queryFn: queryRepayments });
