import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PointsSummaryRow {
  week_start: string;
  total_accounts: number;
  accounts_with_points: number;
  total_closing_pts: number;
  total_awarded: number;
  total_redeemed: number;
  total_expired: number;
  redemption_rate: number;
}

export interface PointsDistributionRow {
  bucket: string;
  account_count: number;
  pct: number;
}

// ---------------------------------------------------------------------------
// 1. Weekly Points Program Overview
// ---------------------------------------------------------------------------

export async function getPointsSummary(
  startDate: Date,
  endDate: Date,
): Promise<PointsSummaryRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(data_delivered_date, ISOWEEK)) AS week_start,
      COUNT(DISTINCT px_dw010_sub_acct_num) AS total_accounts,
      COUNT(DISTINCT CASE WHEN f9_dw010_cls_pt > 0 THEN px_dw010_sub_acct_num END) AS accounts_with_points,
      SUM(f9_dw010_cls_pt) AS total_closing_pts,
      SUM(f9_dw010_awrd_pt) AS total_awarded,
      SUM(ABS(f9_dw010_rdm_pt)) AS total_redeemed,
      SUM(f9_dw010_expi_pt) AS total_expired,
      ROUND(
        SAFE_DIVIDE(SUM(ABS(f9_dw010_rdm_pt)), SUM(f9_dw010_awrd_pt)) * 100,
        2
      ) AS redemption_rate
    FROM ${TABLES.points_summary}
    WHERE data_delivered_date BETWEEN @startDate AND @endDate
    GROUP BY week_start
    ORDER BY week_start
  `;

  return runQuery<PointsSummaryRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Points Distribution — Bucket analysis of closing balances
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 2a. Points Flow Trend — monthly earned, redeemed, expired, net
// ---------------------------------------------------------------------------

export interface PointsFlowTrendRow {
  month: string;
  earned: number;
  redeemed: number;
  expired: number;
  net: number;
}

export async function getPointsFlowTrend(
  startDate: Date,
  endDate: Date,
): Promise<PointsFlowTrendRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m', data_delivered_date) AS month,
      SUM(f9_dw010_awrd_pt) AS earned,
      SUM(ABS(f9_dw010_rdm_pt)) AS redeemed,
      SUM(f9_dw010_expi_pt) AS expired,
      SUM(f9_dw010_awrd_pt) - SUM(ABS(f9_dw010_rdm_pt)) - SUM(f9_dw010_expi_pt) AS net
    FROM ${TABLES.points_summary}
    WHERE data_delivered_date BETWEEN @startDate AND @endDate
    GROUP BY month
    ORDER BY month
  `;

  return runQuery<PointsFlowTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2b. Points Closing Balance — monthly total points and member count
// ---------------------------------------------------------------------------

export interface PointsClosingBalanceRow {
  month: string;
  total_points: number;
  total_members: number;
}

export async function getPointsClosingBalance(
  startDate: Date,
  endDate: Date,
): Promise<PointsClosingBalanceRow[]> {
  const sql = `
    WITH monthly AS (
      SELECT
        FORMAT_DATE('%Y-%m', data_delivered_date) AS month,
        px_dw010_sub_acct_num,
        f9_dw010_cls_pt,
        ROW_NUMBER() OVER (
          PARTITION BY px_dw010_sub_acct_num, FORMAT_DATE('%Y-%m', data_delivered_date)
          ORDER BY data_delivered_date DESC
        ) AS rn
      FROM ${TABLES.points_summary}
      WHERE data_delivered_date BETWEEN @startDate AND @endDate
    )
    SELECT
      month,
      SUM(f9_dw010_cls_pt) AS total_points,
      COUNT(DISTINCT CASE WHEN f9_dw010_cls_pt > 0 THEN px_dw010_sub_acct_num END) AS total_members
    FROM monthly
    WHERE rn = 1
    GROUP BY month
    ORDER BY month
  `;

  return runQuery<PointsClosingBalanceRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2c. Redemption Breakdown — by category (from points_details)
// ---------------------------------------------------------------------------

export interface RedemptionBreakdownRow {
  category: string;
  points: number;
  count: number;
}

export async function getRedemptionBreakdown(
  startDate: Date,
  endDate: Date,
): Promise<RedemptionBreakdownRow[]> {
  const sql = `
    SELECT
      COALESCE(fx_dw011_txn_desc, 'Unknown') AS category,
      SUM(ABS(f9_dw011_pt)) AS points,
      COUNT(*) AS count
    FROM ${TABLES.points_details}
    WHERE data_delivered_date BETWEEN @startDate AND @endDate
      AND f9_dw011_pt < 0
    GROUP BY category
    ORDER BY points DESC
  `;

  return runQuery<RedemptionBreakdownRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 3. Points Distribution — Bucket analysis of closing balances
// ---------------------------------------------------------------------------

export async function getPointsDistribution(
  snapshotDate: Date,
): Promise<PointsDistributionRow[]> {
  const sql = `
    WITH bucketed AS (
      SELECT
        CASE
          WHEN f9_dw010_cls_pt = 0 THEN '0'
          WHEN f9_dw010_cls_pt BETWEEN 1 AND 100 THEN '1-100'
          WHEN f9_dw010_cls_pt BETWEEN 101 AND 500 THEN '101-500'
          WHEN f9_dw010_cls_pt BETWEEN 501 AND 1000 THEN '501-1000'
          WHEN f9_dw010_cls_pt BETWEEN 1001 AND 5000 THEN '1001-5000'
          ELSE '5001+'
        END AS bucket,
        px_dw010_sub_acct_num
      FROM ${TABLES.points_summary}
      WHERE data_delivered_date = @snapshotDate
    ),
    counts AS (
      SELECT
        bucket,
        COUNT(DISTINCT px_dw010_sub_acct_num) AS account_count
      FROM bucketed
      GROUP BY bucket
    ),
    total AS (
      SELECT SUM(account_count) AS total_count FROM counts
    )
    SELECT
      c.bucket,
      c.account_count,
      ROUND(SAFE_DIVIDE(c.account_count, t.total_count) * 100, 2) AS pct
    FROM counts c
    CROSS JOIN total t
    ORDER BY
      CASE c.bucket
        WHEN '0' THEN 1
        WHEN '1-100' THEN 2
        WHEN '101-500' THEN 3
        WHEN '501-1000' THEN 4
        WHEN '1001-5000' THEN 5
        WHEN '5001+' THEN 6
      END
  `;

  return runQuery<PointsDistributionRow>(sql, {
    snapshotDate: toSqlDate(snapshotDate),
  });
}
