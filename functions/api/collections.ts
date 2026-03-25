import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";

async function queryCollections(_startDate: string, _endDate: string, env: Env, _filters: ParsedFilters) {
  const [cureRateTrend] = await Promise.all([
    // Cure Rate Trend — monthly, all-time (no date filter needed)
    runQuery(
      `WITH prep AS (
        SELECT
          CASE WHEN EXTRACT(DAY FROM due_date) >= 15
            THEN DATE_TRUNC(DATE_ADD(due_date, INTERVAL 1 MONTH), MONTH)
            ELSE DATE_TRUNC(due_date, MONTH)
          END AS month_due_date,
          dpd_bi, fl_ft, days_post_due,
          COUNT(*) AS cnt,
          COUNT(DISTINCT loc) AS cnt_loc,
          SUM(clobal_cured) AS clobal_cured,
          SUM(clo_bal) AS total_clobal
        FROM ${TABLES.collection_cure_rate_raw}
        WHERE fl_ft = 0 AND dpd_bi = 1
        GROUP BY ALL
      ),
      add_cum AS (
        SELECT *,
          SUM(clobal_cured) OVER (PARTITION BY month_due_date, dpd_bi, fl_ft ORDER BY days_post_due) AS cumul_clobal_cured,
          SUM(total_clobal) OVER (PARTITION BY month_due_date, dpd_bi, fl_ft) AS total_clobal_all,
          SAFE_DIVIDE(
            SUM(clobal_cured) OVER (PARTITION BY month_due_date, dpd_bi, fl_ft ORDER BY days_post_due),
            SUM(total_clobal) OVER (PARTITION BY month_due_date, dpd_bi, fl_ft)
          ) AS cum_collection_rate
        FROM prep
      )
      SELECT
        FORMAT_DATE('%Y-%m', month_due_date) AS month,
        ROUND(cum_collection_rate * 100, 2) AS cure_rate_pct,
        cumul_clobal_cured AS cured_balance,
        total_clobal_all AS total_balance
      FROM add_cum
      WHERE days_post_due >= 27 AND days_post_due <= 30
      QUALIFY ROW_NUMBER() OVER (PARTITION BY month_due_date ORDER BY days_post_due DESC) = 1
      ORDER BY month_due_date`,
      undefined,
      env,
    ),
  ]);

  return { cureRateTrend };
}

export const onRequest = createHandler({ section: "collections", queryFn: queryCollections });
