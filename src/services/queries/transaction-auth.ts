import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthMetricsRow {
  week_start: string;
  approved_count: number;
  declined_count: number;
  total_count: number;
  approval_rate: number;
}

export interface ChannelMixRow {
  week_start: string;
  transaction_channel: string;
  txn_count: number;
  total_amount: number;
}

export interface TopMerchantRow {
  merchant_name: string;
  txn_count: number;
  total_amount: number;
  avg_amount: number;
}

export interface TicketSizeTrendRow {
  week_start: string;
  avg_ticket_size: number;
  median_ticket_size: number;
}

// ---------------------------------------------------------------------------
// 1. Weekly Auth Metrics: approval count, decline count, total, approval rate
// ---------------------------------------------------------------------------

export async function getAuthMetrics(
  startDate: Date,
  endDate: Date,
): Promise<AuthMetricsRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
      COUNTIF(transaction_response_code = '00') AS approved_count,
      COUNTIF(transaction_response_code != '00') AS declined_count,
      COUNT(*) AS total_count,
      ROUND(SAFE_DIVIDE(COUNTIF(transaction_response_code = '00'), COUNT(*)) * 100, 2) AS approval_rate
    FROM ${TABLES.transaction_authorized}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY week_start
    ORDER BY week_start
  `;

  return runQuery<AuthMetricsRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Channel Mix: transaction_channel breakdown
// ---------------------------------------------------------------------------

export async function getChannelMix(
  startDate: Date,
  endDate: Date,
): Promise<ChannelMixRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
      COALESCE(transaction_channel, 'Unknown') AS transaction_channel,
      COUNT(*) AS txn_count,
      ROUND(SUM(SAFE_CAST(transaction_amount AS FLOAT64)), 0) AS total_amount
    FROM ${TABLES.transaction_authorized}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY week_start, transaction_channel
    ORDER BY week_start, txn_count DESC
  `;

  return runQuery<ChannelMixRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 3. Top 20 Merchants by txn count
// ---------------------------------------------------------------------------

export async function getTopMerchants(
  startDate: Date,
  endDate: Date,
): Promise<TopMerchantRow[]> {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(merchant_name), ''), 'Unknown') AS merchant_name,
      COUNT(*) AS txn_count,
      ROUND(SUM(SAFE_CAST(transaction_amount AS FLOAT64)), 0) AS total_amount,
      ROUND(AVG(SAFE_CAST(transaction_amount AS FLOAT64)), 0) AS avg_amount
    FROM ${TABLES.transaction_authorized}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      AND transaction_response_code = '00'
    GROUP BY merchant_name
    ORDER BY txn_count DESC
    LIMIT 20
  `;

  return runQuery<TopMerchantRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 4. Weekly Avg Transaction Amount (ticket size trend)
// ---------------------------------------------------------------------------

export async function getTicketSizeTrend(
  startDate: Date,
  endDate: Date,
): Promise<TicketSizeTrendRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
      ROUND(AVG(SAFE_CAST(transaction_amount AS FLOAT64)), 0) AS avg_ticket_size,
      ROUND(APPROX_QUANTILES(SAFE_CAST(transaction_amount AS FLOAT64), 100)[OFFSET(50)], 0) AS median_ticket_size
    FROM ${TABLES.transaction_authorized}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      AND transaction_response_code = '00'
      AND SAFE_CAST(transaction_amount AS FLOAT64) > 0
    GROUP BY week_start
    ORDER BY week_start
  `;

  return runQuery<TicketSizeTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
