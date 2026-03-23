import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";

async function queryReferral(startDate: string, endDate: string, env: Env) {
  const [funnel, byChannel, funnelTrend, approvalRate, perUser] = await Promise.all([
    // Weekly referral funnel
    runQuery(
      `WITH started AS (
        SELECT FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
          COUNT(DISTINCT referred_user_id) AS started
        FROM ${TABLES.referral_application_started} WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        GROUP BY week_start
      ), approved AS (
        SELECT FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
          COUNT(DISTINCT user_id) AS approved
        FROM ${TABLES.referral_approved} WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        GROUP BY week_start
      )
      SELECT s.week_start, s.started, COALESCE(a.approved, 0) AS approved,
        ROUND(SAFE_DIVIDE(COALESCE(a.approved, 0), s.started)*100, 2) AS conversion_rate
      FROM started s LEFT JOIN approved a ON s.week_start = a.week_start ORDER BY s.week_start`,
      { startDate, endDate }, env,
    ),
    // By channel
    runQuery(
      `WITH started AS (
        SELECT COALESCE(referring_source, 'unknown') AS referring_source, COALESCE(referring_medium, 'unknown') AS referring_medium,
          COUNT(DISTINCT referred_user_id) AS started_count
        FROM ${TABLES.referral_application_started} WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        GROUP BY referring_source, referring_medium
      ), approved AS (
        SELECT COALESCE(r.referring_source, 'unknown') AS referring_source, COALESCE(r.referring_medium, 'unknown') AS referring_medium,
          COUNT(DISTINCT a.user_id) AS approved_count
        FROM ${TABLES.referral_approved} a
        INNER JOIN ${TABLES.referral_application_started} r ON a.user_id = r.referred_user_id
        WHERE DATE(a.timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        GROUP BY referring_source, referring_medium
      )
      SELECT s.referring_source, s.referring_medium, s.started_count, COALESCE(a.approved_count, 0) AS approved_count,
        ROUND(SAFE_DIVIDE(COALESCE(a.approved_count, 0), s.started_count)*100, 2) AS conversion_rate
      FROM started s LEFT JOIN approved a ON s.referring_source = a.referring_source AND s.referring_medium = a.referring_medium
      ORDER BY s.started_count DESC`,
      { startDate, endDate }, env,
    ),
    // Monthly funnel trend
    runQuery(
      `WITH started AS (
        SELECT FORMAT_DATE('%Y-%m', DATE(timestamp, 'Asia/Jakarta')) AS month,
          COUNT(DISTINCT referred_user_id) AS started, COUNT(DISTINCT user_id) AS shared
        FROM ${TABLES.referral_application_started} WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        GROUP BY month
      ), approved AS (
        SELECT FORMAT_DATE('%Y-%m', DATE(timestamp, 'Asia/Jakarta')) AS month, COUNT(DISTINCT user_id) AS approved
        FROM ${TABLES.referral_approved} WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        GROUP BY month
      )
      SELECT s.month, s.shared, s.started, COALESCE(a.approved, 0) AS approved
      FROM started s LEFT JOIN approved a ON s.month = a.month ORDER BY s.month`,
      { startDate, endDate }, env,
    ),
    // Monthly approval rate
    runQuery(
      `WITH started AS (
        SELECT FORMAT_DATE('%Y-%m', DATE(timestamp, 'Asia/Jakarta')) AS month, COUNT(DISTINCT referred_user_id) AS started
        FROM ${TABLES.referral_application_started} WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        GROUP BY month
      ), approved AS (
        SELECT FORMAT_DATE('%Y-%m', DATE(timestamp, 'Asia/Jakarta')) AS month, COUNT(DISTINCT user_id) AS approved
        FROM ${TABLES.referral_approved} WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        GROUP BY month
      )
      SELECT s.month, s.started, COALESCE(a.approved, 0) AS approved,
        ROUND(SAFE_DIVIDE(COALESCE(a.approved, 0), s.started)*100, 2) AS rate
      FROM started s LEFT JOIN approved a ON s.month = a.month ORDER BY s.month`,
      { startDate, endDate }, env,
    ),
    // Referrals per user distribution
    runQuery(
      `WITH user_counts AS (
        SELECT user_id, COUNT(DISTINCT referred_user_id) AS referral_count
        FROM ${TABLES.referral_application_started} WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        GROUP BY user_id
      ), bucketed AS (
        SELECT CASE WHEN referral_count = 1 THEN '1' WHEN referral_count = 2 THEN '2' WHEN referral_count = 3 THEN '3' ELSE '4+' END AS bucket
        FROM user_counts
      )
      SELECT bucket, COUNT(*) AS users FROM bucketed GROUP BY bucket
      ORDER BY CASE bucket WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 WHEN '4+' THEN 4 END`,
      { startDate, endDate }, env,
    ),
  ]);
  return { funnel, byChannel, funnelTrend, approvalRate, perUser };
}

export const onRequest = createHandler({ section: "referral", queryFn: queryReferral });
