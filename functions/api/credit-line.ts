import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";

async function queryCreditLine(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  const [trend, byType, volumeTrend] = await Promise.all([
    runQuery(
      `SELECT FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
        COUNT(*) AS cli_count, ROUND(AVG(SAFE_CAST(credit_line_change AS FLOAT64)), 0) AS avg_credit_line_change,
        COUNT(DISTINCT user_id) AS unique_users
      FROM ${TABLES.credit_line_increased} WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY week_start ORDER BY week_start`,
      { startDate, endDate }, env,
    ),
    runQuery(
      `SELECT COALESCE(credit_line_update_type, 'unknown') AS credit_line_update_type,
        COUNT(*) AS cli_count, ROUND(AVG(SAFE_CAST(credit_line_change AS FLOAT64)), 0) AS avg_credit_line_change,
        COUNT(DISTINCT user_id) AS unique_users
      FROM ${TABLES.credit_line_increased} WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY credit_line_update_type ORDER BY cli_count DESC`,
      { startDate, endDate }, env,
    ),
    runQuery(
      `SELECT FORMAT_DATE('%Y-%m', DATE(timestamp, 'Asia/Jakarta')) AS month,
        COUNT(*) AS cli_count, ROUND(SUM(SAFE_CAST(credit_line_change AS FLOAT64)), 0) AS total_increase_idr
      FROM ${TABLES.credit_line_increased} WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY month ORDER BY month`,
      { startDate, endDate }, env,
    ),
  ]);
  return { trend, byType, volumeTrend };
}

export const onRequest = createHandler({ section: "credit-line", queryFn: queryCreditLine });
