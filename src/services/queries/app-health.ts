import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActiveUsersRow {
  week_start: string;
  dau: number;
  wau: number;
  mau: number;
  dau_mau_ratio: number;
}

export interface TopScreenRow {
  screen_name: string;
  view_count: number;
  unique_users: number;
}

export interface SessionMetricsRow {
  week_start: string;
  total_sessions: number;
  avg_screens_per_session: number;
  avg_session_duration_sec: number;
  error_count: number;
  error_rate: number;
}

// ---------------------------------------------------------------------------
// 1. DAU / WAU / MAU from application_opened events
//    IMPORTANT: tracks and screens are HUGE tables — always partition by date.
// ---------------------------------------------------------------------------

export async function getActiveUsers(
  startDate: Date,
  endDate: Date,
): Promise<ActiveUsersRow[]> {
  const sql = `
    WITH daily_active AS (
      SELECT
        DATE(timestamp, 'Asia/Jakarta') AS activity_date,
        user_id
      FROM ${TABLES.tracks}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        AND event = 'application_opened'
        AND user_id IS NOT NULL
      GROUP BY activity_date, user_id
    ),

    weekly_windows AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(activity_date, ISOWEEK)) AS week_start,
        activity_date,
        user_id
      FROM daily_active
    ),

    weekly_metrics AS (
      SELECT
        week_start,
        -- DAU: avg distinct users per day within the week
        ROUND(COUNT(DISTINCT CONCAT(CAST(activity_date AS STRING), '-', user_id)) * 1.0
              / COUNT(DISTINCT activity_date), 0) AS dau,
        -- WAU: distinct users in the week
        COUNT(DISTINCT user_id) AS wau
      FROM weekly_windows
      GROUP BY week_start
    ),

    monthly_users AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(activity_date, ISOWEEK)) AS week_start,
        COUNT(DISTINCT user_id) AS mau
      FROM daily_active
      WHERE activity_date BETWEEN
        DATE_SUB(DATE_TRUNC(activity_date, ISOWEEK), INTERVAL 27 DAY)
        AND DATE_ADD(DATE_TRUNC(activity_date, ISOWEEK), INTERVAL 6 DAY)
      GROUP BY week_start
    )

    SELECT
      wm.week_start,
      wm.dau,
      wm.wau,
      COALESCE(mu.mau, wm.wau) AS mau,
      ROUND(SAFE_DIVIDE(wm.dau, COALESCE(mu.mau, wm.wau)) * 100, 2) AS dau_mau_ratio
    FROM weekly_metrics wm
    LEFT JOIN monthly_users mu
      ON wm.week_start = mu.week_start
    ORDER BY wm.week_start
  `;

  return runQuery<ActiveUsersRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Top screens by view count
// ---------------------------------------------------------------------------

export async function getTopScreens(
  startDate: Date,
  endDate: Date,
): Promise<TopScreenRow[]> {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(name), ''), 'unknown') AS screen_name,
      COUNT(*) AS view_count,
      COUNT(DISTINCT user_id) AS unique_users
    FROM ${TABLES.screens}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      AND user_id IS NOT NULL
    GROUP BY screen_name
    ORDER BY view_count DESC
    LIMIT 20
  `;

  return runQuery<TopScreenRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 3. Session metrics from context_session_id
// ---------------------------------------------------------------------------

export async function getSessionMetrics(
  startDate: Date,
  endDate: Date,
): Promise<SessionMetricsRow[]> {
  const sql = `
    WITH session_data AS (
      SELECT
        DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK) AS week_start,
        context_session_id,
        COUNT(*) AS event_count,
        TIMESTAMP_DIFF(MAX(timestamp), MIN(timestamp), SECOND) AS session_duration_sec
      FROM ${TABLES.tracks}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        AND context_session_id IS NOT NULL
        AND user_id IS NOT NULL
      GROUP BY week_start, context_session_id
    ),

    screen_counts AS (
      SELECT
        DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK) AS week_start,
        context_session_id,
        COUNT(*) AS screen_count
      FROM ${TABLES.screens}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        AND context_session_id IS NOT NULL
        AND user_id IS NOT NULL
      GROUP BY week_start, context_session_id
    ),

    error_events AS (
      SELECT
        DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK) AS week_start,
        COUNT(*) AS error_count
      FROM ${TABLES.tracks}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        AND (event LIKE '%error%' OR event LIKE '%fail%' OR event LIKE '%crash%')
        AND user_id IS NOT NULL
      GROUP BY week_start
    )

    SELECT
      FORMAT_DATE('%Y-%m-%d', sd.week_start) AS week_start,
      COUNT(DISTINCT sd.context_session_id) AS total_sessions,
      ROUND(AVG(COALESCE(sc.screen_count, 0)), 1) AS avg_screens_per_session,
      ROUND(AVG(sd.session_duration_sec), 0) AS avg_session_duration_sec,
      COALESCE(MAX(ee.error_count), 0) AS error_count,
      ROUND(SAFE_DIVIDE(COALESCE(MAX(ee.error_count), 0), COUNT(DISTINCT sd.context_session_id)) * 100, 2) AS error_rate
    FROM session_data sd
    LEFT JOIN screen_counts sc
      ON sd.week_start = sc.week_start
      AND sd.context_session_id = sc.context_session_id
    LEFT JOIN error_events ee
      ON sd.week_start = ee.week_start
    GROUP BY sd.week_start
    ORDER BY sd.week_start
  `;

  return runQuery<SessionMetricsRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
