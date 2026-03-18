import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActiveExperimentRow {
  experiment_id: string;
  variant_id: string;
  user_count: number;
  total_exposures: number;
}

export interface ExperimentExposureTrendRow {
  date: string;
  exposures: number;
}

// ---------------------------------------------------------------------------
// 1. Active Experiments (with variant-level user counts)
// ---------------------------------------------------------------------------

export async function getActiveExperiments(
  startDate: Date,
  endDate: Date,
): Promise<ActiveExperimentRow[]> {
  const sql = `
    SELECT
      experiment_id,
      variant_id,
      COUNT(DISTINCT user_id) AS user_count,
      COUNT(*) AS total_exposures
    FROM ${TABLES.experiment_viewed}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY experiment_id, variant_id
    HAVING COUNT(DISTINCT user_id) > 100
    ORDER BY total_exposures DESC
  `;

  return runQuery<ActiveExperimentRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Daily Exposure Trend
// ---------------------------------------------------------------------------

export async function getExperimentExposureTrend(
  startDate: Date,
  endDate: Date,
): Promise<ExperimentExposureTrendRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE(timestamp, 'Asia/Jakarta')) AS date,
      COUNT(*) AS exposures
    FROM ${TABLES.experiment_viewed}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY date
    ORDER BY date
  `;

  return runQuery<ExperimentExposureTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
