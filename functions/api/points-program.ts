import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";

async function queryPointsProgram(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  const [summary, flowTrend, closingBalance, redemptionBreakdown] = await Promise.all([
    runQuery(
      `SELECT FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(data_delivered_date, ISOWEEK)) AS week_start,
        COUNT(DISTINCT px_dw010_sub_acct_num) AS total_accounts,
        COUNT(DISTINCT CASE WHEN f9_dw010_cls_pt > 0 THEN px_dw010_sub_acct_num END) AS accounts_with_points,
        SUM(f9_dw010_cls_pt) AS total_closing_pts, SUM(f9_dw010_awrd_pt) AS total_awarded,
        SUM(ABS(f9_dw010_rdm_pt)) AS total_redeemed, SUM(f9_dw010_expi_pt) AS total_expired,
        ROUND(SAFE_DIVIDE(SUM(ABS(f9_dw010_rdm_pt)), SUM(f9_dw010_awrd_pt))*100, 2) AS redemption_rate
      FROM ${TABLES.points_summary} WHERE data_delivered_date BETWEEN @startDate AND @endDate
      GROUP BY week_start ORDER BY week_start`,
      { startDate, endDate }, env,
    ),
    runQuery(
      `SELECT FORMAT_DATE('%Y-%m', data_delivered_date) AS month,
        SUM(f9_dw010_awrd_pt) AS earned, SUM(ABS(f9_dw010_rdm_pt)) AS redeemed,
        SUM(f9_dw010_expi_pt) AS expired,
        SUM(f9_dw010_awrd_pt) - SUM(ABS(f9_dw010_rdm_pt)) - SUM(f9_dw010_expi_pt) AS net
      FROM ${TABLES.points_summary} WHERE data_delivered_date BETWEEN @startDate AND @endDate
      GROUP BY month ORDER BY month`,
      { startDate, endDate }, env,
    ),
    runQuery(
      `WITH monthly AS (
        SELECT FORMAT_DATE('%Y-%m', data_delivered_date) AS month, px_dw010_sub_acct_num, f9_dw010_cls_pt,
          ROW_NUMBER() OVER (PARTITION BY px_dw010_sub_acct_num, FORMAT_DATE('%Y-%m', data_delivered_date) ORDER BY data_delivered_date DESC) AS rn
        FROM ${TABLES.points_summary} WHERE data_delivered_date BETWEEN @startDate AND @endDate
      ) SELECT month, SUM(f9_dw010_cls_pt) AS total_points,
        COUNT(DISTINCT CASE WHEN f9_dw010_cls_pt > 0 THEN px_dw010_sub_acct_num END) AS total_members
      FROM monthly WHERE rn = 1 GROUP BY month ORDER BY month`,
      { startDate, endDate }, env,
    ),
    runQuery(
      `SELECT COALESCE(fx_dw011_txn_desc, 'Unknown') AS category, SUM(ABS(f9_dw011_pt)) AS points, COUNT(*) AS count
      FROM ${TABLES.points_details} WHERE data_delivered_date BETWEEN @startDate AND @endDate AND f9_dw011_pt < 0
      GROUP BY category ORDER BY points DESC`,
      { startDate, endDate }, env,
    ),
  ]);
  return { summary, flowTrend, closingBalance, redemptionBreakdown };
}

export const onRequest = createHandler({ section: "points-program", queryFn: queryPointsProgram });
