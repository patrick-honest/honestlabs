import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReferralFunnelRow {
  week_start: string;
  started: number;
  approved: number;
  conversion_rate: number;
}

export interface ReferralByChannelRow {
  referring_source: string;
  referring_medium: string;
  started_count: number;
  approved_count: number;
  conversion_rate: number;
}

// ---------------------------------------------------------------------------
// 1. Referral Funnel — Weekly started, approved, conversion rate
// ---------------------------------------------------------------------------

export async function getReferralFunnel(
  startDate: Date,
  endDate: Date,
): Promise<ReferralFunnelRow[]> {
  const sql = `
    WITH started AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
        COUNT(DISTINCT referred_user_id) AS started
      FROM ${TABLES.referral_application_started}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY week_start
    ),
    approved AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
        COUNT(DISTINCT user_id) AS approved
      FROM ${TABLES.referral_approved}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY week_start
    )
    SELECT
      s.week_start,
      s.started,
      COALESCE(a.approved, 0) AS approved,
      ROUND(SAFE_DIVIDE(COALESCE(a.approved, 0), s.started) * 100, 2) AS conversion_rate
    FROM started s
    LEFT JOIN approved a ON s.week_start = a.week_start
    ORDER BY s.week_start
  `;

  return runQuery<ReferralFunnelRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Referral by Channel — referring_source + referring_medium breakdown
// ---------------------------------------------------------------------------

export async function getReferralByChannel(
  startDate: Date,
  endDate: Date,
): Promise<ReferralByChannelRow[]> {
  const sql = `
    WITH started AS (
      SELECT
        COALESCE(referring_source, 'unknown') AS referring_source,
        COALESCE(referring_medium, 'unknown') AS referring_medium,
        COUNT(DISTINCT referred_user_id) AS started_count
      FROM ${TABLES.referral_application_started}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY referring_source, referring_medium
    ),
    approved AS (
      SELECT
        COALESCE(r.referring_source, 'unknown') AS referring_source,
        COALESCE(r.referring_medium, 'unknown') AS referring_medium,
        COUNT(DISTINCT a.user_id) AS approved_count
      FROM ${TABLES.referral_approved} a
      INNER JOIN ${TABLES.referral_application_started} r
        ON a.user_id = r.referred_user_id
      WHERE DATE(a.timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY referring_source, referring_medium
    )
    SELECT
      s.referring_source,
      s.referring_medium,
      s.started_count,
      COALESCE(a.approved_count, 0) AS approved_count,
      ROUND(SAFE_DIVIDE(COALESCE(a.approved_count, 0), s.started_count) * 100, 2) AS conversion_rate
    FROM started s
    LEFT JOIN approved a
      ON s.referring_source = a.referring_source
      AND s.referring_medium = a.referring_medium
    ORDER BY s.started_count DESC
  `;

  return runQuery<ReferralByChannelRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 3. Referral Funnel Trend — monthly shared, started, approved
// ---------------------------------------------------------------------------

export interface ReferralFunnelTrendRow {
  month: string;
  shared: number;
  started: number;
  approved: number;
}

export async function getReferralFunnelTrend(
  startDate: Date,
  endDate: Date,
): Promise<ReferralFunnelTrendRow[]> {
  const sql = `
    WITH started AS (
      SELECT
        FORMAT_DATE('%Y-%m', DATE(timestamp, 'Asia/Jakarta')) AS month,
        COUNT(DISTINCT referred_user_id) AS started,
        COUNT(DISTINCT user_id) AS shared
      FROM ${TABLES.referral_application_started}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY month
    ),
    approved AS (
      SELECT
        FORMAT_DATE('%Y-%m', DATE(timestamp, 'Asia/Jakarta')) AS month,
        COUNT(DISTINCT user_id) AS approved
      FROM ${TABLES.referral_approved}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY month
    )
    SELECT
      s.month,
      s.shared,
      s.started,
      COALESCE(a.approved, 0) AS approved
    FROM started s
    LEFT JOIN approved a ON s.month = a.month
    ORDER BY s.month
  `;

  return runQuery<ReferralFunnelTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 4. Referral Approval Rate — monthly started vs approved with rate
// ---------------------------------------------------------------------------

export interface ReferralApprovalRateRow {
  month: string;
  started: number;
  approved: number;
  rate: number;
}

export async function getReferralApprovalRate(
  startDate: Date,
  endDate: Date,
): Promise<ReferralApprovalRateRow[]> {
  const sql = `
    WITH started AS (
      SELECT
        FORMAT_DATE('%Y-%m', DATE(timestamp, 'Asia/Jakarta')) AS month,
        COUNT(DISTINCT referred_user_id) AS started
      FROM ${TABLES.referral_application_started}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY month
    ),
    approved AS (
      SELECT
        FORMAT_DATE('%Y-%m', DATE(timestamp, 'Asia/Jakarta')) AS month,
        COUNT(DISTINCT user_id) AS approved
      FROM ${TABLES.referral_approved}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY month
    )
    SELECT
      s.month,
      s.started,
      COALESCE(a.approved, 0) AS approved,
      ROUND(SAFE_DIVIDE(COALESCE(a.approved, 0), s.started) * 100, 2) AS rate
    FROM started s
    LEFT JOIN approved a ON s.month = a.month
    ORDER BY s.month
  `;

  return runQuery<ReferralApprovalRateRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 5. Referrals Per User — bucket distribution
// ---------------------------------------------------------------------------

export interface ReferralsPerUserRow {
  bucket: string;
  users: number;
}

export async function getReferralsPerUser(
  startDate: Date,
  endDate: Date,
): Promise<ReferralsPerUserRow[]> {
  const sql = `
    WITH user_counts AS (
      SELECT
        user_id,
        COUNT(DISTINCT referred_user_id) AS referral_count
      FROM ${TABLES.referral_application_started}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY user_id
    ),
    bucketed AS (
      SELECT
        CASE
          WHEN referral_count = 1 THEN '1'
          WHEN referral_count = 2 THEN '2'
          WHEN referral_count = 3 THEN '3'
          ELSE '4+'
        END AS bucket
      FROM user_counts
    )
    SELECT
      bucket,
      COUNT(*) AS users
    FROM bucketed
    GROUP BY bucket
    ORDER BY
      CASE bucket
        WHEN '1' THEN 1
        WHEN '2' THEN 2
        WHEN '3' THEN 3
        WHEN '4+' THEN 4
      END
  `;

  return runQuery<ReferralsPerUserRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
