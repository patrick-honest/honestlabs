import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChannelVolumeRow {
  utm_source: string;
  applications: number;
  approvals: number;
  approval_rate: number;
}

export interface ChannelDelinquencyRow {
  utm_source: string;
  total_approved: number;
  dpd_30_plus: number;
  dpd_rate: number;
}

// ---------------------------------------------------------------------------
// 1. Channel Volume & Approval Rate
// ---------------------------------------------------------------------------

export async function getChannelVolumeAndApproval(
  startDate: Date,
  endDate: Date,
): Promise<ChannelVolumeRow[]> {
  const sql = `
    WITH applications AS (
      SELECT
        COALESCE(NULLIF(context_traits_first_utm_source, ''), 'organic') AS utm_source,
        user_id
      FROM ${TABLES.milestone_complete}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        AND application_status = 'Application started'
      GROUP BY utm_source, user_id
    ),
    decisions AS (
      SELECT
        user_id
      FROM ${TABLES.decision_completed}
      WHERE decision = 'APPROVED'
        AND DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    )
    SELECT
      a.utm_source,
      COUNT(DISTINCT a.user_id) AS applications,
      COUNT(DISTINCT d.user_id) AS approvals,
      ROUND(SAFE_DIVIDE(COUNT(DISTINCT d.user_id), COUNT(DISTINCT a.user_id)) * 100, 2) AS approval_rate
    FROM applications a
    LEFT JOIN decisions d ON a.user_id = d.user_id
    GROUP BY a.utm_source
    ORDER BY applications DESC
  `;

  return runQuery<ChannelVolumeRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Channel Delinquency (30+ DPD rate per UTM source)
// ---------------------------------------------------------------------------

export async function getChannelDelinquency(
  startDate: Date,
  endDate: Date,
): Promise<ChannelDelinquencyRow[]> {
  const sql = `
    WITH channel_users AS (
      SELECT
        COALESCE(NULLIF(context_traits_first_utm_source, ''), 'organic') AS utm_source,
        user_id
      FROM ${TABLES.milestone_complete}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        AND application_status = 'Application started'
      GROUP BY utm_source, user_id
    ),
    approved_users AS (
      SELECT
        cu.utm_source,
        cu.user_id,
        d.credit_line
      FROM channel_users cu
      INNER JOIN ${TABLES.decision_completed} d
        ON cu.user_id = d.user_id
        AND d.decision = 'APPROVED'
    ),
    delinquent AS (
      SELECT
        au.utm_source,
        au.user_id
      FROM approved_users au
      INNER JOIN ${TABLES.cms_line_of_credit} cloc
        ON au.user_id = cloc.user_id
      INNER JOIN ${TABLES.financial_account_updates} fau
        ON cloc.account_number = fau.account_number
      WHERE SAFE_CAST(fau.days_past_due AS INT64) >= 30
      GROUP BY au.utm_source, au.user_id
    )
    SELECT
      au.utm_source,
      COUNT(DISTINCT au.user_id) AS total_approved,
      COUNT(DISTINCT del.user_id) AS dpd_30_plus,
      ROUND(SAFE_DIVIDE(COUNT(DISTINCT del.user_id), COUNT(DISTINCT au.user_id)) * 100, 2) AS dpd_rate
    FROM approved_users au
    LEFT JOIN delinquent del
      ON au.utm_source = del.utm_source AND au.user_id = del.user_id
    GROUP BY au.utm_source
    ORDER BY total_approved DESC
  `;

  return runQuery<ChannelDelinquencyRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
