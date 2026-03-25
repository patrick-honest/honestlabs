import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeeklyTicketTrendRow {
  week_start: string;
  ticket_count: number;
  resolved_count: number;
  avg_first_response_hrs: number;
  avg_resolution_hrs: number;
}

export interface TopContactReasonRow {
  reason: string;
  ticket_count: number;
}

// ---------------------------------------------------------------------------
// 1. Weekly Ticket Trend — volume, resolved, response & resolution times
// ---------------------------------------------------------------------------

export async function getWeeklyTicketTrend(
  startDate: Date,
  endDate: Date,
): Promise<WeeklyTicketTrendRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', created_at), ISOWEEK)) AS week_start,
      COUNT(DISTINCT ticket_id) AS ticket_count,
      COUNTIF(status IN ('Resolved', 'Closed')) AS resolved_count,
      ROUND(AVG(SAFE_CAST(first_response_time AS FLOAT64) / 3600), 2) AS avg_first_response_hrs,
      ROUND(AVG(SAFE_CAST(time_to_resolution AS FLOAT64) / 3600), 2) AS avg_resolution_hrs
    FROM ${TABLES.freshdesk_ticket_summary}
    WHERE created_at >= @startDate AND created_at < @endDate
    GROUP BY week_start
    ORDER BY week_start
  `;

  return runQuery<WeeklyTicketTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Top Contact Reasons — top 15 by ticket count
// ---------------------------------------------------------------------------

export async function getTopContactReasons(
  startDate: Date,
  endDate: Date,
): Promise<TopContactReasonRow[]> {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(category_contact_reason), ''), 'Unknown') AS reason,
      COUNT(DISTINCT ticket_id) AS ticket_count
    FROM ${TABLES.freshdesk_ticket_summary}
    WHERE created_at >= @startDate AND created_at < @endDate
    GROUP BY reason
    ORDER BY ticket_count DESC
    LIMIT 15
  `;

  return runQuery<TopContactReasonRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
