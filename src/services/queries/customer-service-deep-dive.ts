import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TicketVolumeTrendRow {
  month: string;
  ticket_count: number;
  unique_users: number;
}

export interface TicketsByCategoryRow {
  category: string;
  count: number;
  pct: number;
}

export interface ResolutionMetricsRow {
  month: string;
  avg_resolution_hours: number;
  avg_first_response_hours: number;
}

export interface TicketsByPriorityRow {
  priority: string;
  count: number;
  pct: number;
}

export interface TicketsByStatusRow {
  status: string;
  count: number;
}

// ---------------------------------------------------------------------------
// 1. Ticket Volume Trend — monthly
// ---------------------------------------------------------------------------

export async function getTicketVolumeTrend(
  startDate: Date,
  endDate: Date,
): Promise<TicketVolumeTrendRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m', DATE(created_at, 'Asia/Jakarta')) AS month,
      COUNT(DISTINCT ticket_id) AS ticket_count,
      COUNT(DISTINCT user_id) AS unique_users
    FROM ${TABLES.freshdesk_ticket_summary}
    WHERE DATE(created_at, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY month
    ORDER BY month
  `;

  return runQuery<TicketVolumeTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Tickets by Category (contact reason)
// ---------------------------------------------------------------------------

export async function getTicketsByCategory(
  startDate: Date,
  endDate: Date,
): Promise<TicketsByCategoryRow[]> {
  const sql = `
    WITH category_counts AS (
      SELECT
        COALESCE(NULLIF(TRIM(category_contact_reason), ''), 'Unknown') AS category,
        COUNT(DISTINCT ticket_id) AS count
      FROM ${TABLES.freshdesk_ticket_summary}
      WHERE DATE(created_at, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY category
    ),
    total AS (
      SELECT SUM(count) AS total_count FROM category_counts
    )
    SELECT
      cc.category,
      cc.count,
      ROUND(cc.count * 100.0 / NULLIF(t.total_count, 0), 2) AS pct
    FROM category_counts cc
    CROSS JOIN total t
    ORDER BY cc.count DESC
    LIMIT 20
  `;

  return runQuery<TicketsByCategoryRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 3. Resolution Metrics — monthly
// ---------------------------------------------------------------------------

export async function getResolutionMetrics(
  startDate: Date,
  endDate: Date,
): Promise<ResolutionMetricsRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m', DATE(created_at, 'Asia/Jakarta')) AS month,
      ROUND(AVG(TIMESTAMP_DIFF(resolved_at, created_at, SECOND) / 3600.0), 2) AS avg_resolution_hours,
      ROUND(AVG(first_response_time / 3600.0), 2) AS avg_first_response_hours
    FROM ${TABLES.freshdesk_ticket_summary}
    WHERE DATE(created_at, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      AND resolved_at IS NOT NULL
    GROUP BY month
    ORDER BY month
  `;

  return runQuery<ResolutionMetricsRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 4. Tickets by Priority
// ---------------------------------------------------------------------------

export async function getTicketsByPriority(
  startDate: Date,
  endDate: Date,
): Promise<TicketsByPriorityRow[]> {
  const sql = `
    WITH priority_counts AS (
      SELECT
        COALESCE(CAST(priority AS STRING), 'Unknown') AS priority,
        COUNT(DISTINCT ticket_id) AS count
      FROM ${TABLES.freshdesk_ticket_summary}
      WHERE DATE(created_at, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY priority
    ),
    total AS (
      SELECT SUM(count) AS total_count FROM priority_counts
    )
    SELECT
      pc.priority,
      pc.count,
      ROUND(pc.count * 100.0 / NULLIF(t.total_count, 0), 2) AS pct
    FROM priority_counts pc
    CROSS JOIN total t
    ORDER BY pc.count DESC
  `;

  return runQuery<TicketsByPriorityRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 5. Tickets by Status
// ---------------------------------------------------------------------------

export async function getTicketsByStatus(
  startDate: Date,
  endDate: Date,
): Promise<TicketsByStatusRow[]> {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(status), ''), 'Unknown') AS status,
      COUNT(DISTINCT ticket_id) AS count
    FROM ${TABLES.freshdesk_ticket_summary}
    WHERE DATE(created_at, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY status
    ORDER BY count DESC
  `;

  return runQuery<TicketsByStatusRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
