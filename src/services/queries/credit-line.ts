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

// ---------------------------------------------------------------------------
// 3. CLI Volume Trend — monthly count and total increase
// ---------------------------------------------------------------------------

export interface CLIVolumeTrendRow {
  month: string;
  cli_count: number;
  total_increase_idr: number;
}

export async function getCliVolumeTrend(
  startDate: Date,
  endDate: Date,
): Promise<CLIVolumeTrendRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m', DATE(timestamp, 'Asia/Jakarta')) AS month,
      COUNT(*) AS cli_count,
      ROUND(SUM(SAFE_CAST(credit_line_change AS FLOAT64)), 0) AS total_increase_idr
    FROM ${TABLES.credit_line_increased}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY month
    ORDER BY month
  `;

  return runQuery<CLIVolumeTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 4. CLI by Risk Category — breakdown by risk score buckets
// ---------------------------------------------------------------------------

export interface CLIByRiskCategoryRow {
  risk_category: string;
  count: number;
  avg_increase: number;
}

export async function getCliByRiskCategory(
  startDate: Date,
  endDate: Date,
): Promise<CLIByRiskCategoryRow[]> {
  const sql = `
    SELECT
      COALESCE(credit_line_update_type, 'unknown') AS risk_category,
      COUNT(*) AS count,
      ROUND(AVG(SAFE_CAST(credit_line_change AS FLOAT64)), 0) AS avg_increase
    FROM ${TABLES.credit_line_increased}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY risk_category
    ORDER BY count DESC
  `;

  return runQuery<CLIByRiskCategoryRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 5. Utilization Pre/Post CLI — monthly avg utilization
// ---------------------------------------------------------------------------

export interface UtilizationPrePostRow {
  month: string;
  pre_cli_util: number;
  post_cli_util: number;
}

export async function getUtilizationPrePostCli(
  startDate: Date,
  endDate: Date,
): Promise<UtilizationPrePostRow[]> {
  const sql = `
    WITH cli_users AS (
      SELECT
        FORMAT_DATE('%Y-%m', DATE(timestamp, 'Asia/Jakarta')) AS month,
        user_id,
        SAFE_CAST(previous_credit_limit AS FLOAT64) AS prev_limit,
        SAFE_CAST(credit_limit AS FLOAT64) AS new_limit
      FROM ${TABLES.credit_line_increased}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    ),
    with_balance AS (
      SELECT
        cu.month,
        cu.user_id,
        cu.prev_limit,
        cu.new_limit,
        loc.credit_limit AS current_limit
      FROM cli_users cu
      INNER JOIN ${TABLES.cms_line_of_credit} loc ON cu.user_id = loc.user_id
    )
    SELECT
      month,
      ROUND(AVG(SAFE_DIVIDE(current_limit - new_limit + prev_limit, prev_limit) * 100), 2) AS pre_cli_util,
      ROUND(AVG(SAFE_DIVIDE(current_limit, new_limit) * 100), 2) AS post_cli_util
    FROM with_balance
    WHERE prev_limit > 0 AND new_limit > 0
    GROUP BY month
    ORDER BY month
  `;

  return runQuery<UtilizationPrePostRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
