import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types — Rudderstack-based (existing)
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
// Types — Finexus DW007 deep-dive queries
// ---------------------------------------------------------------------------

export interface AuthApprovalRateTrendRow {
  week: string;
  total_auths: number;
  approved: number;
  declined: number;
  approval_rate: number;
}

export interface DeclineByReasonCodeRow {
  reason_code: string;
  count: number;
  pct: number;
}

export interface AuthByChannelRow {
  channel: string;
  count: number;
  amount: number;
}

export interface AuthVolumeByDayRow {
  date: string;
  count: number;
  amount: number;
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

// ===========================================================================
// Finexus DW007 Deep-Dive Queries
// ===========================================================================

// Valid txn filter: exclude payments, balance enquiry, refunds
const DW007_TXN_FILTER = `fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')`;
// Approved = stat is null or empty
const DW007_APPROVED = `(fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')`;
const DW007_DECLINED = `fx_dw007_stat IS NOT NULL AND TRIM(fx_dw007_stat) != '' AND fx_dw007_stat != ' '`;

// ---------------------------------------------------------------------------
// 5. Auth Approval Rate Trend (weekly, from DW007)
// ---------------------------------------------------------------------------

export async function getAuthApprovalRateTrend(
  startDate: Date,
  endDate: Date,
): Promise<AuthApprovalRateTrendRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(f9_dw007_dt, ISOWEEK)) AS week,
      COUNT(*) AS total_auths,
      COUNTIF(${DW007_APPROVED}) AS approved,
      COUNTIF(${DW007_DECLINED}) AS declined,
      ROUND(SAFE_DIVIDE(COUNTIF(${DW007_APPROVED}), COUNT(*)) * 100, 2) AS approval_rate
    FROM ${TABLES.authorized_transaction}
    WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
      AND ${DW007_TXN_FILTER}
    GROUP BY week
    ORDER BY week
  `;

  return runQuery<AuthApprovalRateTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 6. Decline by Reason Code (from DW007)
// ---------------------------------------------------------------------------

export async function getDeclineByReasonCode(
  startDate: Date,
  endDate: Date,
): Promise<DeclineByReasonCodeRow[]> {
  const sql = `
    WITH declines AS (
      SELECT
        COALESCE(NULLIF(TRIM(fx_dw007_stat), ''), 'UNKNOWN') AS reason_code,
        COUNT(*) AS count
      FROM ${TABLES.authorized_transaction}
      WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
        AND ${DW007_TXN_FILTER}
        AND ${DW007_DECLINED}
      GROUP BY reason_code
    ),
    total AS (
      SELECT SUM(count) AS total_declines FROM declines
    )
    SELECT
      d.reason_code,
      d.count,
      ROUND(SAFE_DIVIDE(d.count, t.total_declines) * 100, 2) AS pct
    FROM declines d
    CROSS JOIN total t
    ORDER BY d.count DESC
  `;

  return runQuery<DeclineByReasonCodeRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 7. Auth by Channel: Online / Offline / QRIS (from DW007)
// ---------------------------------------------------------------------------

export async function getAuthByChannel(
  startDate: Date,
  endDate: Date,
): Promise<AuthByChannelRow[]> {
  const sql = `
    SELECT
      CASE
        WHEN fx_dw007_txn_typ = 'TM' THEN 'Online'
        WHEN fx_dw007_txn_typ = 'RA' AND fx_dw007_rte_dest = 'L' THEN 'QRIS'
        ELSE 'Offline'
      END AS channel,
      COUNT(*) AS count,
      ROUND(SUM(f9_dw007_ori_amt / 100), 0) AS amount
    FROM ${TABLES.authorized_transaction}
    WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
      AND ${DW007_TXN_FILTER}
      AND ${DW007_APPROVED}
    GROUP BY channel
    ORDER BY count DESC
  `;

  return runQuery<AuthByChannelRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 8. Auth Volume by Day (from DW007)
// ---------------------------------------------------------------------------

export async function getAuthVolumeByDay(
  startDate: Date,
  endDate: Date,
): Promise<AuthVolumeByDayRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', f9_dw007_dt) AS date,
      COUNT(*) AS count,
      ROUND(SUM(f9_dw007_ori_amt / 100), 0) AS amount
    FROM ${TABLES.authorized_transaction}
    WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
      AND ${DW007_TXN_FILTER}
      AND ${DW007_APPROVED}
    GROUP BY date
    ORDER BY date
  `;

  return runQuery<AuthVolumeByDayRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
