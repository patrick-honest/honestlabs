import { runQuery } from "@/lib/bigquery";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QrisAdoptionMetrics {
  week_start: string;
  total_users: number;
  qris_users: number;
  qris_adoption_rate: number;
  new_qris_users: number;
}

export interface QrisVsNonQris {
  segment: string; // "QRIS Users" | "Non-QRIS Users"
  avg_txn_count: number;
  avg_total_spend_idr: number;
  avg_spend_per_txn: number;
  avg_days_active: number;
  pct_multi_channel: number;
}

export interface QrisProfitabilityRow {
  month: string;
  qris_txn_count: number;
  qris_volume_idr: number;
  qris_interchange_idr: number;
  non_qris_txn_count: number;
  non_qris_volume_idr: number;
  non_qris_interchange_idr: number;
  qris_user_total_spend_idr: number;
  non_qris_user_total_spend_idr: number;
}

export interface QrisRetention {
  cohort_month: string;
  mob: number;
  qris_retention_rate: number;
  non_qris_retention_rate: number;
}

export interface QrisMerchantCategory {
  category: string;
  txn_count: number;
  total_spend_idr: number;
  unique_users: number;
  avg_spend_idr: number;
}

// ---------------------------------------------------------------------------
// 1. QRIS adoption over time — weekly
// ---------------------------------------------------------------------------

export async function getQrisAdoption(startDate: string, endDate: string): Promise<QrisAdoptionMetrics[]> {
  const sql = `
    WITH weekly_users AS (
      SELECT
        DATE_TRUNC(f9_dw007_dt, WEEK(MONDAY)) AS week_start,
        COUNT(DISTINCT px_dw007_urn) AS total_users,
        COUNT(DISTINCT CASE
          WHEN fx_dw007_txn_typ = 'RA' AND fx_dw007_rte_dest = 'L' THEN px_dw007_urn
        END) AS qris_users
      FROM \`storage-58f5a02c.mart_finexus.authorized_transaction\`
      WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND f9_dw007_ori_amt > 0
      GROUP BY week_start
    ),
    first_qris AS (
      SELECT
        px_dw007_urn,
        MIN(f9_dw007_dt) AS first_qris_date
      FROM \`storage-58f5a02c.mart_finexus.authorized_transaction\`
      WHERE fx_dw007_txn_typ = 'RA' AND fx_dw007_rte_dest = 'L'
        AND (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND f9_dw007_ori_amt > 0
      GROUP BY px_dw007_urn
    ),
    new_weekly AS (
      SELECT
        DATE_TRUNC(first_qris_date, WEEK(MONDAY)) AS week_start,
        COUNT(*) AS new_qris_users
      FROM first_qris
      WHERE first_qris_date BETWEEN @startDate AND @endDate
      GROUP BY week_start
    )
    SELECT
      FORMAT_DATE('%Y-%m-%d', w.week_start) AS week_start,
      w.total_users,
      w.qris_users,
      ROUND(SAFE_DIVIDE(w.qris_users, w.total_users) * 100, 2) AS qris_adoption_rate,
      COALESCE(n.new_qris_users, 0) AS new_qris_users
    FROM weekly_users w
    LEFT JOIN new_weekly n ON w.week_start = n.week_start
    ORDER BY w.week_start
  `;
  return runQuery<QrisAdoptionMetrics>(sql, { startDate, endDate });
}

// ---------------------------------------------------------------------------
// 2. QRIS vs Non-QRIS user behavior comparison
// ---------------------------------------------------------------------------

export async function getQrisVsNonQris(startDate: string, endDate: string): Promise<QrisVsNonQris[]> {
  const sql = `
    WITH user_txns AS (
      SELECT
        px_dw007_urn,
        COUNT(*) AS txn_count,
        SUM(F9_DW007_AMT_REQ / 100) AS total_spend,
        AVG(F9_DW007_AMT_REQ / 100) AS avg_per_txn,
        COUNT(DISTINCT f9_dw007_dt) AS days_active,
        MAX(CASE WHEN fx_dw007_txn_typ = 'RA' AND fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END) AS is_qris_user,
        COUNT(DISTINCT fx_dw007_txn_typ) AS channel_count
      FROM \`storage-58f5a02c.mart_finexus.authorized_transaction\`
      WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND f9_dw007_ori_amt > 0
      GROUP BY px_dw007_urn
    )
    SELECT
      CASE WHEN is_qris_user = 1 THEN 'QRIS Users' ELSE 'Non-QRIS Users' END AS segment,
      ROUND(AVG(txn_count), 1) AS avg_txn_count,
      ROUND(AVG(total_spend)) AS avg_total_spend_idr,
      ROUND(AVG(avg_per_txn)) AS avg_spend_per_txn,
      ROUND(AVG(days_active), 1) AS avg_days_active,
      ROUND(SAFE_DIVIDE(COUNTIF(channel_count > 1), COUNT(*)) * 100, 1) AS pct_multi_channel
    FROM user_txns
    GROUP BY segment
  `;
  return runQuery<QrisVsNonQris>(sql, { startDate, endDate });
}

// ---------------------------------------------------------------------------
// 3. Profitability comparison (monthly)
// Note: Interchange is estimated at 0.7% for QRIS (MDR), ~1.5% for non-QRIS
// ---------------------------------------------------------------------------

export async function getQrisProfitability(startDate: string, endDate: string): Promise<QrisProfitabilityRow[]> {
  const sql = `
    WITH monthly_txns AS (
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw007_dt) AS month,
        px_dw007_urn,
        fx_dw007_txn_typ,
        fx_dw007_rte_dest,
        F9_DW007_AMT_REQ / 100 AS amount_idr
      FROM \`storage-58f5a02c.mart_finexus.authorized_transaction\`
      WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND f9_dw007_ori_amt > 0
    ),
    qris_users AS (
      SELECT DISTINCT px_dw007_urn
      FROM monthly_txns
      WHERE fx_dw007_txn_typ = 'RA' AND fx_dw007_rte_dest = 'L'
    ),
    aggregated AS (
      SELECT
        t.month,
        -- QRIS transactions
        COUNTIF(t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L') AS qris_txn_count,
        ROUND(SUM(CASE WHEN t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L' THEN t.amount_idr ELSE 0 END)) AS qris_volume_idr,
        ROUND(SUM(CASE WHEN t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L' THEN t.amount_idr * 0.007 ELSE 0 END)) AS qris_interchange_idr,
        -- Non-QRIS transactions
        COUNTIF(NOT (t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L')) AS non_qris_txn_count,
        ROUND(SUM(CASE WHEN NOT (t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L') THEN t.amount_idr ELSE 0 END)) AS non_qris_volume_idr,
        ROUND(SUM(CASE WHEN NOT (t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L') THEN t.amount_idr * 0.015 ELSE 0 END)) AS non_qris_interchange_idr,
        -- Total spend by QRIS users (all their txns, not just QRIS)
        ROUND(SUM(CASE WHEN q.px_dw007_urn IS NOT NULL THEN t.amount_idr ELSE 0 END)) AS qris_user_total_spend_idr,
        -- Total spend by non-QRIS users
        ROUND(SUM(CASE WHEN q.px_dw007_urn IS NULL THEN t.amount_idr ELSE 0 END)) AS non_qris_user_total_spend_idr
      FROM monthly_txns t
      LEFT JOIN qris_users q ON t.px_dw007_urn = q.px_dw007_urn
      GROUP BY t.month
    )
    SELECT * FROM aggregated ORDER BY month
  `;
  return runQuery<QrisProfitabilityRow>(sql, { startDate, endDate });
}

// ---------------------------------------------------------------------------
// 4. QRIS merchant category breakdown (uses MCC mapping)
// ---------------------------------------------------------------------------

export async function getQrisMerchantCategories(startDate: string, endDate: string, limit: number = 15): Promise<QrisMerchantCategory[]> {
  const sql = `
    WITH mcc_map AS (
      SELECT * FROM UNNEST(ARRAY<STRUCT<mcc STRING, category STRING>>[
        STRUCT('5411','Grocery/Supermarket'),STRUCT('5814','Fast Food'),STRUCT('5812','Restaurants'),
        STRUCT('5541','Gas Stations'),STRUCT('5542','Fuel Dispensers'),STRUCT('5311','Department Stores'),
        STRUCT('5499','Food Stores'),STRUCT('5912','Pharmacies'),
        STRUCT('5813','Bars/Nightclubs'),STRUCT('5462','Bakeries'),STRUCT('5441','Candy/Confectionery'),
        STRUCT('5451','Dairy Products'),STRUCT('5300','Wholesale Clubs'),STRUCT('5200','Home Supply'),
        STRUCT('4121','Taxi/Rideshare'),STRUCT('5732','Electronics'),STRUCT('5691','Clothing'),
        STRUCT('5977','Cosmetics'),STRUCT('7011','Hotels'),STRUCT('5999','Retail Stores')
      ])
    )
    SELECT
      COALESCE(m.category, 'Other') AS category,
      COUNT(*) AS txn_count,
      ROUND(SUM(t.F9_DW007_AMT_REQ / 100)) AS total_spend_idr,
      COUNT(DISTINCT t.px_dw007_urn) AS unique_users,
      ROUND(AVG(t.F9_DW007_AMT_REQ / 100)) AS avg_spend_idr
    FROM \`storage-58f5a02c.mart_finexus.authorized_transaction\` t
    LEFT JOIN mcc_map m ON t.f9_dw007_mcc = m.mcc
    WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
      AND t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L'
      AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
      AND t.f9_dw007_ori_amt > 0
    GROUP BY category
    ORDER BY txn_count DESC
    LIMIT @limit
  `;
  return runQuery<QrisMerchantCategory>(sql, { startDate, endDate, limit });
}
