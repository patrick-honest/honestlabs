import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChannelBreakdownRow {
  channel: string;
  txn_count: number;
  spend_idr: number;
  unique_cards: number;
}

export interface DeclineBreakdownRow {
  code: string;
  description: string;
  cnt: number;
  amount_idr: number;
}

export interface QrisOnlyMerchantGrowthRow {
  month: string;
  new_merchants: number;
  cumulative_merchants: number;
}

export interface MixedMerchantQrisVolumeRow {
  merchant_name: string;
  qris_txn_count: number;
  qris_spend_idr: number;
  total_txn_count: number;
  total_spend_idr: number;
}

// ---------------------------------------------------------------------------
// Decline code descriptions
// ---------------------------------------------------------------------------

const DECLINE_CODE_DESCRIPTIONS: Record<string, string> = {
  D: "Declined by Issuer — card blocked, limit exceeded, or risk flag",
  C: "Captured / Reversed — transaction was reversed or captured for settlement",
  T: "Timeout — no response from network within time limit",
  X: "Expired / Invalid — card expired or invalid details",
  I: "Invalid Card — card number not recognized",
  N: "Insufficient Funds — not enough available credit",
};

// ---------------------------------------------------------------------------
// 1. Channel Breakdown: Online vs Offline vs QRIS
// ---------------------------------------------------------------------------

export async function getChannelBreakdown(
  startDate: Date,
  endDate: Date,
): Promise<ChannelBreakdownRow[]> {
  const sql = `
    SELECT
      CASE
        WHEN fx_dw007_txn_typ = 'RA' AND fx_dw007_rte_dest = 'L' THEN 'QRIS'
        WHEN fx_dw007_txn_typ = 'TM' THEN 'Online'
        ELSE 'Offline'
      END AS channel,
      COUNT(*) AS txn_count,
      ROUND(SUM(f9_dw007_amt_req / 100), 0) AS spend_idr,
      COUNT(DISTINCT f9_dw007_prin_crn) AS unique_cards
    FROM ${TABLES.authorized_transaction}
    WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
      AND (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
      AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
    GROUP BY channel
  `;

  return runQuery<ChannelBreakdownRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Transaction Decline Breakdown
// ---------------------------------------------------------------------------

export async function getDeclineBreakdown(
  startDate: Date,
  endDate: Date,
): Promise<DeclineBreakdownRow[]> {
  const sql = `
    SELECT
      fx_dw007_stat AS code,
      COUNT(*) AS cnt,
      ROUND(SUM(f9_dw007_amt_req / 100), 0) AS amount_idr
    FROM ${TABLES.authorized_transaction}
    WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
      AND fx_dw007_stat IS NOT NULL
      AND TRIM(fx_dw007_stat) != ''
      AND fx_dw007_stat != ' '
    GROUP BY code
    ORDER BY cnt DESC
  `;

  const rows = await runQuery<{ code: string; cnt: number; amount_idr: number }>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });

  return rows.map((row) => ({
    ...row,
    description:
      DECLINE_CODE_DESCRIPTIONS[row.code] ??
      `Unknown status code: ${row.code}`,
  }));
}

// ---------------------------------------------------------------------------
// 3. QRIS-Only Merchant Cumulative Growth
// ---------------------------------------------------------------------------

export async function getQrisOnlyMerchantGrowth(): Promise<QrisOnlyMerchantGrowthRow[]> {
  const sql = `
    WITH merchant_channels AS (
      SELECT
        fx_dw007_merc_name AS merchant_name,
        MAX(CASE
          WHEN fx_dw007_txn_typ = 'RA' AND fx_dw007_rte_dest = 'L' THEN 1
          ELSE 0
        END) AS has_qris,
        MAX(CASE
          WHEN NOT (fx_dw007_txn_typ = 'RA' AND fx_dw007_rte_dest = 'L') THEN 1
          ELSE 0
        END) AS has_non_qris
      FROM ${TABLES.authorized_transaction}
      WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY merchant_name
    ),
    qris_only_merchants AS (
      SELECT merchant_name
      FROM merchant_channels
      WHERE has_qris = 1 AND has_non_qris = 0
    ),
    first_appearance AS (
      SELECT
        qom.merchant_name,
        FORMAT_DATE('%Y-%m', MIN(dw7.f9_dw007_dt)) AS first_month
      FROM qris_only_merchants qom
      JOIN ${TABLES.authorized_transaction} dw7
        ON qom.merchant_name = dw7.fx_dw007_merc_name
      WHERE (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
        AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY qom.merchant_name
    ),
    monthly_new AS (
      SELECT
        first_month AS month,
        COUNT(*) AS new_merchants
      FROM first_appearance
      GROUP BY first_month
    )
    SELECT
      month,
      new_merchants,
      SUM(new_merchants) OVER (ORDER BY month) AS cumulative_merchants
    FROM monthly_new
    ORDER BY month
  `;

  return runQuery<QrisOnlyMerchantGrowthRow>(sql);
}

// ---------------------------------------------------------------------------
// 4. Mixed Merchants: QRIS volume at merchants with both QRIS & non-QRIS txns
// ---------------------------------------------------------------------------

export async function getMixedMerchantQrisVolume(
  startDate: Date,
  endDate: Date,
): Promise<MixedMerchantQrisVolumeRow[]> {
  const sql = `
    WITH merchant_channels AS (
      SELECT
        fx_dw007_merc_name AS merchant_name,
        MAX(CASE
          WHEN fx_dw007_txn_typ = 'RA' AND fx_dw007_rte_dest = 'L' THEN 1
          ELSE 0
        END) AS has_qris,
        MAX(CASE
          WHEN NOT (fx_dw007_txn_typ = 'RA' AND fx_dw007_rte_dest = 'L') THEN 1
          ELSE 0
        END) AS has_non_qris
      FROM ${TABLES.authorized_transaction}
      WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY merchant_name
    ),
    mixed_merchants AS (
      SELECT merchant_name
      FROM merchant_channels
      WHERE has_qris = 1 AND has_non_qris = 1
    )
    SELECT
      mm.merchant_name,
      COUNTIF(dw7.fx_dw007_txn_typ = 'RA' AND dw7.fx_dw007_rte_dest = 'L') AS qris_txn_count,
      ROUND(SUM(CASE
        WHEN dw7.fx_dw007_txn_typ = 'RA' AND dw7.fx_dw007_rte_dest = 'L'
        THEN dw7.f9_dw007_amt_req / 100
        ELSE 0
      END), 0) AS qris_spend_idr,
      COUNT(*) AS total_txn_count,
      ROUND(SUM(dw7.f9_dw007_amt_req / 100), 0) AS total_spend_idr
    FROM mixed_merchants mm
    JOIN ${TABLES.authorized_transaction} dw7
      ON mm.merchant_name = dw7.fx_dw007_merc_name
    WHERE dw7.f9_dw007_dt BETWEEN @startDate AND @endDate
      AND (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
      AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
    GROUP BY mm.merchant_name
    ORDER BY qris_spend_idr DESC
    LIMIT 50
  `;

  return runQuery<MixedMerchantQrisVolumeRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
