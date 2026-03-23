import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";

async function queryPortfolio(startDate: string, endDate: string, env: Env) {
  const [snapshot, statusBreakdown, creditLimitDist] = await Promise.all([
    runQuery(
      `SELECT FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(f9_dw004_bus_dt, ISOWEEK)) AS week_start,
        COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts, COUNTIF(fx_dw004_loc_stat IN ('G','N')) AS active_accounts,
        COUNTIF(fx_dw004_loc_stat='B') AS blocked_accounts, COUNTIF(fx_dw004_loc_stat='C') AS closed_accounts,
        ROUND(AVG(CAST(f9_dw004_loc_lmt AS FLOAT64)),2) AS avg_credit_limit, ROUND(AVG(CAST(f9_dw004_clo_bal AS FLOAT64)),2) AS avg_balance,
        ROUND(SAFE_DIVIDE(SUM(CAST(f9_dw004_clo_bal AS FLOAT64)), NULLIF(SUM(CAST(f9_dw004_loc_lmt AS FLOAT64)),0))*100,2) AS utilization_pct,
        COUNTIF(f9_dw004_curr_dpd>0) AS delinquent_accounts,
        ROUND(SAFE_DIVIDE(COUNTIF(f9_dw004_curr_dpd>0), COUNT(DISTINCT p9_dw004_loc_acct))*100,2) AS delinquency_rate
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate AND EXTRACT(DAYOFWEEK FROM f9_dw004_bus_dt)=1
      GROUP BY week_start ORDER BY week_start`,
      { startDate, endDate }, env,
    ),
    runQuery(
      `SELECT fx_dw004_loc_stat AS status, COUNT(DISTINCT p9_dw004_loc_acct) AS accounts
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt=(SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates} WHERE f9_dw004_bus_dt<=@endDate)
      GROUP BY status ORDER BY accounts DESC`,
      { endDate }, env,
    ),
    runQuery(
      `SELECT CASE WHEN CAST(f9_dw004_loc_lmt AS FLOAT64)<=1 THEN 'RP1 (<=1)' WHEN CAST(f9_dw004_loc_lmt AS FLOAT64)<=5000000 THEN '<=5M'
        WHEN CAST(f9_dw004_loc_lmt AS FLOAT64)<=10000000 THEN '5-10M' WHEN CAST(f9_dw004_loc_lmt AS FLOAT64)<=25000000 THEN '10-25M'
        WHEN CAST(f9_dw004_loc_lmt AS FLOAT64)<=50000000 THEN '25-50M' ELSE '>50M' END AS bucket,
        COUNT(DISTINCT p9_dw004_loc_acct) AS accounts
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt=(SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates} WHERE f9_dw004_bus_dt<=@endDate)
        AND fx_dw004_loc_stat IN ('G','N')
      GROUP BY bucket ORDER BY MIN(CAST(f9_dw004_loc_lmt AS FLOAT64))`,
      { endDate }, env,
    ),
  ]);
  return { snapshot, statusBreakdown, creditLimitDist };
}

export const onRequest = createHandler({ section: "portfolio", queryFn: queryPortfolio });
