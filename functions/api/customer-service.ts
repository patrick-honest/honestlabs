import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";

async function queryCustomerService(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  const [weeklyTicketTrend, topContactReasons] = await Promise.all([
    // Weekly Ticket Trend — volume, resolved, response & resolution times
    // Page expects: week_start, ticket_count, resolved_count, avg_first_response_hrs, avg_resolution_hrs
    runQuery(
      `SELECT
        FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', created_at), ISOWEEK)) AS week_start,
        COUNT(DISTINCT ticket_id) AS ticket_count,
        COUNTIF(status IN ('Resolved', 'Closed')) AS resolved_count,
        ROUND(AVG(SAFE_CAST(first_response_time AS FLOAT64) / 3600), 2) AS avg_first_response_hrs,
        ROUND(AVG(SAFE_CAST(time_to_resolution AS FLOAT64) / 3600), 2) AS avg_resolution_hrs
      FROM ${TABLES.freshdesk_ticket_summary}
      WHERE created_at >= @startDate AND created_at < @endDate
      GROUP BY week_start
      ORDER BY week_start`,
      { startDate, endDate },
      env,
    ),

    // Top Contact Reasons — top 15 by ticket count
    // Page expects: reason, ticket_count
    runQuery(
      `SELECT
        COALESCE(NULLIF(TRIM(category_contact_reason), ''), 'Unknown') AS reason,
        COUNT(DISTINCT ticket_id) AS ticket_count
      FROM ${TABLES.freshdesk_ticket_summary}
      WHERE created_at >= @startDate AND created_at < @endDate
      GROUP BY reason
      ORDER BY ticket_count DESC
      LIMIT 15`,
      { startDate, endDate },
      env,
    ),
  ]);

  return { weeklyTicketTrend, topContactReasons };
}

export const onRequest = createHandler({ section: "customer-service", queryFn: queryCustomerService });
