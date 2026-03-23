import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";
import { cycleDateWhere } from "../_shared/filters";

async function queryRisk(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  const [dpdTrend, balanceExposure] = await Promise.all([
    // DPD Distribution Trend — weekly snapshot with buckets
    // The page expects: week_start, current_count, dpd_1_30, dpd_31_60, dpd_61_90, dpd_90_plus, total_accounts, delinquency_rate_30plus
    runQuery(
      `WITH weekly_snapshot AS (
        SELECT
          FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(f9_dw004_bus_dt, ISOWEEK)) AS week_start,
          p9_dw004_loc_acct,
          f9_dw004_curr_dpd,
          f9_dw004_clo_bal,
          ROW_NUMBER() OVER (
            PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(f9_dw004_bus_dt, ISOWEEK))
            ORDER BY f9_dw004_bus_dt DESC
          ) AS rn
        FROM ${TABLES.financial_account_updates} dw4
        WHERE dw4.f9_dw004_bus_dt BETWEEN @startDate AND @endDate
          AND dw4.fx_dw004_loc_stat IN ('G', 'N')
          ${cycleDateWhere(filters, 'dw4')}
      ),
      snapshot AS (
        SELECT * FROM weekly_snapshot WHERE rn = 1
      )
      SELECT
        week_start,
        COUNTIF(f9_dw004_curr_dpd = 0) AS current_count,
        COUNTIF(f9_dw004_curr_dpd BETWEEN 1 AND 30) AS dpd_1_30,
        COUNTIF(f9_dw004_curr_dpd BETWEEN 31 AND 60) AS dpd_31_60,
        COUNTIF(f9_dw004_curr_dpd BETWEEN 61 AND 90) AS dpd_61_90,
        COUNTIF(f9_dw004_curr_dpd > 90) AS dpd_90_plus,
        COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts,
        ROUND(COUNTIF(f9_dw004_curr_dpd > 30) * 100.0 / COUNT(*), 2) AS delinquency_rate_30plus
      FROM snapshot
      GROUP BY week_start
      ORDER BY week_start`,
      { startDate, endDate },
      env,
    ),

    // Balance Exposure by DPD Bucket — point-in-time snapshot
    // The page expects: bucket, accounts, total_balance_idr
    runQuery(
      `WITH ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY p9_dw004_loc_acct
            ORDER BY f9_dw004_bus_dt DESC
          ) AS rn
        FROM ${TABLES.financial_account_updates} dw4
        WHERE dw4.f9_dw004_bus_dt <= @endDate
          AND dw4.fx_dw004_loc_stat IN ('G', 'N')
          ${cycleDateWhere(filters, 'dw4')}
      ),
      snapshot AS (
        SELECT * FROM ranked WHERE rn = 1
      )
      SELECT
        CASE
          WHEN f9_dw004_curr_dpd = 0 THEN 'Current'
          WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30'
          WHEN f9_dw004_curr_dpd BETWEEN 31 AND 60 THEN '31-60'
          WHEN f9_dw004_curr_dpd BETWEEN 61 AND 90 THEN '61-90'
          ELSE '90+'
        END AS bucket,
        COUNT(*) AS accounts,
        ROUND(SUM(f9_dw004_clo_bal / 100), 0) AS total_balance_idr
      FROM snapshot
      GROUP BY bucket
      ORDER BY
        CASE bucket
          WHEN 'Current' THEN 1
          WHEN '1-30' THEN 2
          WHEN '31-60' THEN 3
          WHEN '61-90' THEN 4
          ELSE 5
        END`,
      { endDate },
      env,
    ),
  ]);

  return { dpdTrend, balanceExposure };
}

export const onRequest = createHandler({ section: "risk", queryFn: queryRisk });
