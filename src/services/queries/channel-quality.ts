import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChannelQualityRow {
  utm_source: string;
  reached_decision: number;
  approved: number;
  approval_rate: number;
  dpd30_plus: number;
  approved_with_dpd_data: number;
  dpd30_rate: number;
}

// ---------------------------------------------------------------------------
// Combined Channel Quality — volume, approval rate, and delinquency in one query
//
// Joins:
//   milestone_complete (UTM source)
//   → decision_completed (approval outcome)
//   → cms_line_of_credit (user_id → external_id/loc_acct bridge)
//   → financial_account_updates (DPD at latest snapshot)
// ---------------------------------------------------------------------------

export async function getChannelQuality(
  startDate: Date,
  endDate: Date,
): Promise<ChannelQualityRow[]> {
  const sql = `
    WITH applicants AS (
      SELECT
        user_id,
        COALESCE(NULLIF(context_traits_first_utm_source, ''), 'organic') AS utm_source
      FROM ${TABLES.milestone_complete}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        AND application_status = 'Decision complete'
      GROUP BY user_id, utm_source
    ),

    decisions AS (
      SELECT user_id, decision
      FROM ${TABLES.decision_completed}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    ),

    approved_users AS (
      SELECT DISTINCT d.user_id, a.utm_source
      FROM decisions d
      JOIN applicants a ON d.user_id = a.user_id
      WHERE d.decision = 'APPROVED'
    ),

    dpd AS (
      SELECT
        cloc.user_id,
        dw4.f9_dw004_curr_dpd AS dpd
      FROM ${TABLES.financial_account_updates} dw4
      JOIN ${TABLES.cms_line_of_credit} cloc
        ON dw4.p9_dw004_loc_acct = cloc.external_id
      WHERE dw4.f9_dw004_bus_dt = (
        SELECT MAX(f9_dw004_bus_dt)
        FROM ${TABLES.financial_account_updates}
      )
    )

    SELECT
      a.utm_source,
      COUNT(DISTINCT a.user_id) AS reached_decision,
      COUNT(DISTINCT CASE WHEN d.decision = 'APPROVED' THEN d.user_id END) AS approved,
      ROUND(SAFE_DIVIDE(
        COUNT(DISTINCT CASE WHEN d.decision = 'APPROVED' THEN d.user_id END),
        COUNT(DISTINCT d.user_id)
      ) * 100, 1) AS approval_rate,
      COUNT(DISTINCT CASE WHEN dpd.dpd > 30 THEN au.user_id END) AS dpd30_plus,
      COUNT(DISTINCT au.user_id) AS approved_with_dpd_data,
      ROUND(SAFE_DIVIDE(
        COUNT(DISTINCT CASE WHEN dpd.dpd > 30 THEN au.user_id END),
        NULLIF(COUNT(DISTINCT au.user_id), 0)
      ) * 100, 2) AS dpd30_rate
    FROM applicants a
    LEFT JOIN decisions d ON a.user_id = d.user_id
    LEFT JOIN approved_users au ON a.user_id = au.user_id
    LEFT JOIN dpd ON au.user_id = dpd.user_id
    GROUP BY a.utm_source
    HAVING reached_decision >= 10
    ORDER BY reached_decision DESC
  `;

  return runQuery<ChannelQualityRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
