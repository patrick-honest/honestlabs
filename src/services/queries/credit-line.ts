import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CLITrendRow {
  week_start: string;
  cli_count: number;
  avg_credit_line_change: number;
  unique_users: number;
}

export interface CLIByTypeRow {
  credit_line_update_type: string;
  cli_count: number;
  avg_credit_line_change: number;
  unique_users: number;
}

// ---------------------------------------------------------------------------
// 1. CLI Trend — Weekly CLI count, avg credit_line_change, unique users
// ---------------------------------------------------------------------------

export async function getCLITrend(
  startDate: Date,
  endDate: Date,
): Promise<CLITrendRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
      COUNT(*) AS cli_count,
      ROUND(AVG(SAFE_CAST(credit_line_change AS FLOAT64)), 0) AS avg_credit_line_change,
      COUNT(DISTINCT user_id) AS unique_users
    FROM ${TABLES.credit_line_increased}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY week_start
    ORDER BY week_start
  `;

  return runQuery<CLITrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. CLI by Type — credit_line_update_type breakdown
// ---------------------------------------------------------------------------

export async function getCLIByType(
  startDate: Date,
  endDate: Date,
): Promise<CLIByTypeRow[]> {
  const sql = `
    SELECT
      COALESCE(credit_line_update_type, 'unknown') AS credit_line_update_type,
      COUNT(*) AS cli_count,
      ROUND(AVG(SAFE_CAST(credit_line_change AS FLOAT64)), 0) AS avg_credit_line_change,
      COUNT(DISTINCT user_id) AS unique_users
    FROM ${TABLES.credit_line_increased}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY credit_line_update_type
    ORDER BY cli_count DESC
  `;

  return runQuery<CLIByTypeRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
