import { runQuery, TABLES } from "@/lib/bigquery";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QrisCohortRow {
  grp: string;
  cohort_size: number;
  transactors: number;
  qris_users: number;
  total_spend_usd: number;
  qris_spend_usd: number;
  total_txns: number;
  qris_txns: number;
  avg_spend_per_user: number;
  txn_per_user: number;
  sar: number;
}

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

// ---------------------------------------------------------------------------
// 5. A/B Test Cohort Comparison — Treatment (QRIS enabled) vs Control
//    Source: sandbox_risk.sample_qris_rollout_test_10k_202601
//    Contaminated Control users (those who somehow had QRIS txns) are excluded
//    dynamically.
//    Currency: f9_dw007_amt_req / 100 / 16000 = cents → IDR → USD
// ---------------------------------------------------------------------------

export async function getQrisCohortComparison(
  startDate: string = "2026-02-09",
): Promise<QrisCohortRow[]> {
  const sql = `
    -- CTE 1: Raw experiment cohort
    WITH credit_qris_exp AS (
      SELECT user_id, loc_acct, qris_test_rollout_group AS grp
      FROM ${TABLES.qris_rollout}
    ),

    -- CTE 2: Card number lookup (DW005)
    cards AS (
      SELECT DISTINCT f9_dw005_loc_acct, f9_dw005_crn
      FROM ${TABLES.principal_card_updates}
      WHERE f9_dw005_loc_acct IS NOT NULL
        AND f9_dw005_crn IS NOT NULL
    ),

    -- CTE 3: Contaminated Control users (had QRIS txns despite being Control)
    contaminated AS (
      SELECT DISTINCT c.user_id
      FROM credit_qris_exp c
      JOIN cards k ON c.loc_acct = k.f9_dw005_loc_acct
      JOIN ${TABLES.authorized_transaction} t
        ON k.f9_dw005_crn = t.f9_dw007_prin_crn
      WHERE c.grp = 'Control'
        AND t.fx_dw007_txn_typ = 'RA'
        AND t.fx_dw007_rte_dest = 'L'
        AND t.f9_dw007_dt >= @startDate
        AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
    ),

    -- CTE 4: Clean cohort (contaminated users removed from both groups)
    clean_cohort AS (
      SELECT c.user_id, c.loc_acct, c.grp
      FROM credit_qris_exp c
      WHERE NOT EXISTS (
        SELECT 1 FROM contaminated x WHERE x.user_id = c.user_id
      )
    ),

    -- CTE 5: Authorized transactions joined back to cohort via DW005
    auth_trx AS (
      SELECT
        co.user_id,
        co.grp,
        t.f9_dw007_amt_req / 100.0 / 16000.0 AS spend_usd,
        CASE
          WHEN t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L' THEN 1
          ELSE 0
        END AS is_qris
      FROM clean_cohort co
      JOIN cards k ON co.loc_acct = k.f9_dw005_loc_acct
      JOIN ${TABLES.authorized_transaction} t
        ON k.f9_dw005_crn = t.f9_dw007_prin_crn
      WHERE t.f9_dw007_dt >= @startDate
        AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
        AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND t.f9_dw007_ori_amt > 0
    )

    -- CTE 6: Final aggregation
    SELECT
      co.grp,
      COUNT(DISTINCT co.user_id) AS cohort_size,
      COUNT(DISTINCT a.user_id) AS transactors,
      COUNT(DISTINCT CASE WHEN a.is_qris = 1 THEN a.user_id END) AS qris_users,
      ROUND(COALESCE(SUM(a.spend_usd), 0), 2) AS total_spend_usd,
      ROUND(COALESCE(SUM(CASE WHEN a.is_qris = 1 THEN a.spend_usd ELSE 0 END), 0), 2) AS qris_spend_usd,
      COUNT(a.user_id) AS total_txns,
      COALESCE(SUM(a.is_qris), 0) AS qris_txns,
      ROUND(COALESCE(SUM(a.spend_usd), 0) / NULLIF(COUNT(DISTINCT a.user_id), 0), 2) AS avg_spend_per_user,
      ROUND(CAST(COUNT(a.user_id) AS FLOAT64) / NULLIF(COUNT(DISTINCT a.user_id), 0), 1) AS txn_per_user,
      ROUND(100.0 * COUNT(DISTINCT a.user_id) / COUNT(DISTINCT co.user_id), 1) AS sar
    FROM clean_cohort co
    LEFT JOIN auth_trx a ON co.user_id = a.user_id
    GROUP BY co.grp
    ORDER BY co.grp
  `;

  return runQuery<QrisCohortRow>(sql, { startDate });
}

// ---------------------------------------------------------------------------
// Merchant Reach Analysis
// ---------------------------------------------------------------------------

export interface QrisMerchantSummary {
  qris_only_merchants: number;
  mixed_merchants: number;
  non_qris_only_merchants: number;
}

export interface QrisMerchantGrowthRow {
  month: string;
  new_merchants: number;
  cumulative_merchants: number;
}

export interface MixedMerchantStats {
  qris_txns_at_mixed: number;
  qris_spend_idr_at_mixed: number;
  qris_spend_usd_at_mixed: number;
  mixed_merchant_count: number;
}

/** Count of QRIS-only, mixed, and non-QRIS merchants */
export async function getQrisMerchantBreakdown(): Promise<QrisMerchantSummary> {
  const sql = `
    WITH all_merchants AS (
      SELECT
        fx_dw007_merc_name AS merchant,
        MAX(CASE WHEN fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END) AS has_qris,
        MAX(CASE WHEN fx_dw007_rte_dest != 'L' OR fx_dw007_rte_dest IS NULL THEN 1 ELSE 0 END) AS has_non_qris
      FROM ${TABLES.authorized_transaction}
      WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY merchant
    )
    SELECT
      COUNTIF(has_qris = 1 AND has_non_qris = 0) AS qris_only_merchants,
      COUNTIF(has_qris = 1 AND has_non_qris = 1) AS mixed_merchants,
      COUNTIF(has_qris = 0 AND has_non_qris = 1) AS non_qris_only_merchants
    FROM all_merchants
  `;
  const rows = await runQuery<QrisMerchantSummary>(sql);
  return rows[0] ?? { qris_only_merchants: 0, mixed_merchants: 0, non_qris_only_merchants: 0 };
}

/** Monthly cumulative growth of QRIS-only merchants */
export async function getQrisOnlyMerchantGrowthTrend(): Promise<QrisMerchantGrowthRow[]> {
  const sql = `
    WITH merchant_first_txn AS (
      SELECT
        fx_dw007_merc_name AS merchant,
        MIN(f9_dw007_dt) AS first_qris_date
      FROM ${TABLES.authorized_transaction}
      WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND fx_dw007_rte_dest = 'L'
      GROUP BY merchant
      HAVING merchant NOT IN (
        SELECT DISTINCT fx_dw007_merc_name
        FROM ${TABLES.authorized_transaction}
        WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '')
          AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
          AND (fx_dw007_rte_dest != 'L' OR fx_dw007_rte_dest IS NULL)
      )
    ),
    monthly AS (
      SELECT DATE_TRUNC(first_qris_date, MONTH) AS mth, COUNT(*) AS new_merchants
      FROM merchant_first_txn
      GROUP BY mth
    )
    SELECT
      FORMAT_DATE('%Y-%m', mth) AS month,
      new_merchants,
      SUM(new_merchants) OVER (ORDER BY mth) AS cumulative_merchants
    FROM monthly
    ORDER BY mth
  `;
  return runQuery<QrisMerchantGrowthRow>(sql);
}

/** QRIS transactions at mixed merchants (merchants that also accept non-QRIS) */
export async function getMixedMerchantQrisStats(): Promise<MixedMerchantStats> {
  const sql = `
    WITH mixed_merchants AS (
      SELECT fx_dw007_merc_name AS merchant
      FROM ${TABLES.authorized_transaction}
      WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY merchant
      HAVING MAX(CASE WHEN fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END) = 1
         AND MAX(CASE WHEN fx_dw007_rte_dest != 'L' OR fx_dw007_rte_dest IS NULL THEN 1 ELSE 0 END) = 1
    )
    SELECT
      COUNT(*) AS qris_txns_at_mixed,
      ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64) / 100), 2) AS qris_spend_idr_at_mixed,
      ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 / 16000), 2) AS qris_spend_usd_at_mixed,
      COUNT(DISTINCT t.fx_dw007_merc_name) AS mixed_merchant_count
    FROM ${TABLES.authorized_transaction} t
    JOIN mixed_merchants m ON t.fx_dw007_merc_name = m.merchant
    WHERE (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
      AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      AND t.fx_dw007_rte_dest = 'L'
  `;
  const rows = await runQuery<MixedMerchantStats>(sql);
  return rows[0] ?? { qris_txns_at_mixed: 0, qris_spend_idr_at_mixed: 0, qris_spend_usd_at_mixed: 0, mixed_merchant_count: 0 };
}

// ---------------------------------------------------------------------------
// Interchange Fee Analysis Constants
// ---------------------------------------------------------------------------
// Sources:
//   Card interchange (blended Visa+MC): 1.6% — Kansas City Fed, Aug 2025
//   QRIS MDR weighted avg: 0.55% — PBI No. 24/8/PBI/2022
//     (UR 0.7%, URE 0.63%, UKI 0.3%, UMI 0%)
//   QRIS issuer revenue share: 37% — via PT ALTO Network switcher
//   Effective QRIS issuer rate: 0.55% × 37% = 0.2035%
// ---------------------------------------------------------------------------

export const INTERCHANGE_RATES = {
  /** Blended Visa+MC card interchange rate (Kansas City Fed, Aug 2025) */
  CARD_INTERCHANGE: 0.016,
  /** Weighted avg QRIS MDR (PBI No. 24/8/PBI/2022) */
  QRIS_MDR: 0.0055,
  /** Issuer share of QRIS MDR (PT ALTO Network switcher) */
  QRIS_ISSUER_SHARE: 0.37,
  /** Effective QRIS issuer revenue rate: 0.55% × 37% */
  QRIS_ISSUER_EFFECTIVE: 0.0055 * 0.37, // 0.002035
} as const;

// ---------------------------------------------------------------------------
// Interchange Revenue Projection
// ---------------------------------------------------------------------------

export interface InterchangeProjectionRow {
  grp: string;
  cohort_size: number;
  card_spend_idr: number;
  qris_spend_idr: number;
  total_spend_idr: number;
  card_interchange_idr: number;
  qris_issuer_revenue_idr: number;
  total_revenue_idr: number;
  revenue_per_user_idr: number;
}

/**
 * Per-cohort interchange revenue analysis.
 * Calculates card interchange at 1.6% and QRIS issuer revenue at 0.2035%
 * for Test vs Control groups, normalized per cohort member.
 */
export async function getInterchangeProjection(
  startDate: string = "2026-02-09",
): Promise<InterchangeProjectionRow[]> {
  const sql = `
    -- CTE 1: Raw experiment cohort
    WITH credit_qris_exp AS (
      SELECT user_id, loc_acct, qris_test_rollout_group AS grp
      FROM ${TABLES.qris_rollout}
    ),

    -- CTE 2: Card number lookup (DW005)
    cards AS (
      SELECT DISTINCT f9_dw005_loc_acct, f9_dw005_crn
      FROM ${TABLES.principal_card_updates}
      WHERE f9_dw005_loc_acct IS NOT NULL
        AND f9_dw005_crn IS NOT NULL
    ),

    -- CTE 3: Contaminated Control users (had QRIS txns despite being Control)
    contaminated AS (
      SELECT DISTINCT c.user_id
      FROM credit_qris_exp c
      JOIN cards k ON c.loc_acct = k.f9_dw005_loc_acct
      JOIN ${TABLES.authorized_transaction} t
        ON k.f9_dw005_crn = t.f9_dw007_prin_crn
      WHERE c.grp = 'Control'
        AND t.fx_dw007_txn_typ = 'RA'
        AND t.fx_dw007_rte_dest = 'L'
        AND t.f9_dw007_dt >= @startDate
        AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
    ),

    -- CTE 4: Clean cohort (contaminated users removed from both groups)
    clean_cohort AS (
      SELECT c.user_id, c.loc_acct, c.grp
      FROM credit_qris_exp c
      WHERE NOT EXISTS (
        SELECT 1 FROM contaminated x WHERE x.user_id = c.user_id
      )
    ),

    -- CTE 5: Authorized transactions joined back to cohort via DW005
    -- Amounts in cents → divide by 100 for IDR
    auth_trx AS (
      SELECT
        co.user_id,
        co.grp,
        t.f9_dw007_amt_req / 100.0 AS spend_idr,
        CASE
          WHEN t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L' THEN 1
          ELSE 0
        END AS is_qris
      FROM clean_cohort co
      JOIN cards k ON co.loc_acct = k.f9_dw005_loc_acct
      JOIN ${TABLES.authorized_transaction} t
        ON k.f9_dw005_crn = t.f9_dw007_prin_crn
      WHERE t.f9_dw007_dt >= @startDate
        AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
        AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND t.f9_dw007_ori_amt > 0
    )

    SELECT
      co.grp,
      COUNT(DISTINCT co.user_id) AS cohort_size,
      ROUND(COALESCE(SUM(CASE WHEN a.is_qris = 0 THEN a.spend_idr ELSE 0 END), 0), 2) AS card_spend_idr,
      ROUND(COALESCE(SUM(CASE WHEN a.is_qris = 1 THEN a.spend_idr ELSE 0 END), 0), 2) AS qris_spend_idr,
      ROUND(COALESCE(SUM(a.spend_idr), 0), 2) AS total_spend_idr,
      -- Card interchange at 1.6% (blended Visa+MC, Kansas City Fed Aug 2025)
      ROUND(COALESCE(SUM(CASE WHEN a.is_qris = 0 THEN a.spend_idr ELSE 0 END), 0) * 0.016, 2) AS card_interchange_idr,
      -- QRIS issuer revenue at 0.2035% (0.55% MDR × 37% issuer share, PBI No. 24/8/PBI/2022)
      ROUND(COALESCE(SUM(CASE WHEN a.is_qris = 1 THEN a.spend_idr ELSE 0 END), 0) * 0.002035, 2) AS qris_issuer_revenue_idr,
      -- Total revenue
      ROUND(
        COALESCE(SUM(CASE WHEN a.is_qris = 0 THEN a.spend_idr ELSE 0 END), 0) * 0.016
        + COALESCE(SUM(CASE WHEN a.is_qris = 1 THEN a.spend_idr ELSE 0 END), 0) * 0.002035,
      2) AS total_revenue_idr,
      -- Revenue per cohort member
      ROUND(
        (COALESCE(SUM(CASE WHEN a.is_qris = 0 THEN a.spend_idr ELSE 0 END), 0) * 0.016
         + COALESCE(SUM(CASE WHEN a.is_qris = 1 THEN a.spend_idr ELSE 0 END), 0) * 0.002035)
        / NULLIF(COUNT(DISTINCT co.user_id), 0),
      2) AS revenue_per_user_idr
    FROM clean_cohort co
    LEFT JOIN auth_trx a ON co.user_id = a.user_id
    GROUP BY co.grp
    ORDER BY co.grp
  `;

  return runQuery<InterchangeProjectionRow>(sql, { startDate });
}

// ---------------------------------------------------------------------------
// QRIS Spend at QRIS-Only Merchants (Monthly Trend)
// ---------------------------------------------------------------------------

export interface QrisOnlyMerchantSpendRow {
  month: string;
  total_txns: number;
  qris_txns: number;
  total_spend_idr: number;
  qris_spend_idr: number;
  qris_pct: number;
}

/**
 * Monthly QRIS spend at merchants that have ONLY ever processed QRIS transactions.
 * By definition qris_pct = 100% at these merchants, but shows volume growth over time.
 */
export async function getQrisOnlyMerchantSpendTrend(): Promise<QrisOnlyMerchantSpendRow[]> {
  const sql = `
    -- Merchants that have ONLY ever processed QRIS transactions
    WITH qris_only_merchants AS (
      SELECT fx_dw007_merc_name AS merchant
      FROM ${TABLES.authorized_transaction}
      WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY merchant
      HAVING MAX(CASE WHEN fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END) = 1
         AND MAX(CASE WHEN fx_dw007_rte_dest != 'L' OR fx_dw007_rte_dest IS NULL THEN 1 ELSE 0 END) = 0
    )
    SELECT
      FORMAT_DATE('%Y-%m', t.f9_dw007_dt) AS month,
      COUNT(*) AS total_txns,
      COUNT(*) AS qris_txns,
      ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64) / 100), 2) AS total_spend_idr,
      ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64) / 100), 2) AS qris_spend_idr,
      100.0 AS qris_pct
    FROM ${TABLES.authorized_transaction} t
    JOIN qris_only_merchants m ON t.fx_dw007_merc_name = m.merchant
    WHERE (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
      AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      AND t.fx_dw007_rte_dest = 'L'
      AND t.f9_dw007_ori_amt > 0
    GROUP BY month
    ORDER BY month
  `;
  return runQuery<QrisOnlyMerchantSpendRow>(sql);
}

// ---------------------------------------------------------------------------
// Revolve / Utilization / Fee Revenue by Cohort
// ---------------------------------------------------------------------------

export interface CohortFinancialRow {
  grp: string;
  cohort_size: number;
  accounts_found: number;
  avg_balance_idr: number;
  avg_limit: number;
  utilization_pct: number;
  with_balance: number;
  revolvers: number;
  revolve_rate_pct: number;
  total_fees_idr: number;
  total_chrg_fee_idr: number;
  avg_cycle_day: number;
}

/**
 * Revolve rate, utilization, and fee revenue for each QRIS experiment cohort.
 * Snapshot taken on the last available business date in DW004.
 */
export async function getCohortFinancials(): Promise<CohortFinancialRow[]> {
  const sql = `
    WITH all_users AS (
      SELECT user_id, qris_test_rollout_group AS grp
      FROM ${TABLES.qris_rollout}
    ),
    -- Dynamic exclusion: Control users who had QRIS txns
    contaminated_ctrl AS (
      SELECT DISTINCT u.user_id
      FROM all_users u
      JOIN ${TABLES.cms_line_of_credit} m ON u.user_id = m.user_id
      JOIN ${TABLES.principal_card_updates} p ON p.f9_dw005_loc_acct = m.external_id
      JOIN ${TABLES.authorized_transaction} t ON t.f9_dw007_prin_crn = p.f9_dw005_crn
      WHERE u.grp = 'Control'
        AND t.fx_dw007_rte_dest = 'L'
        AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
    ),
    credit_qris_exp AS (
      SELECT user_id, grp FROM all_users
      WHERE NOT (grp = 'Control' AND user_id IN (SELECT user_id FROM contaminated_ctrl))
    ),
    acct_map AS (
      SELECT c.user_id, c.grp, m.external_id AS loc_acct
      FROM credit_qris_exp c
      JOIN ${TABLES.cms_line_of_credit} m ON c.user_id = m.user_id
    ),
    last_date AS (
      SELECT MAX(f9_dw004_bus_dt) AS dt
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt <= CURRENT_DATE()
    ),
    cohort_size AS (
      SELECT grp, COUNT(DISTINCT user_id) AS sz FROM credit_qris_exp GROUP BY grp
    )
    SELECT
      a.grp,
      cs.sz AS cohort_size,
      COUNT(DISTINCT a.loc_acct) AS accounts_found,
      ROUND(AVG(CAST(d.f9_dw004_loc_bal AS FLOAT64) / 100), 0) AS avg_balance_idr,
      ROUND(AVG(CAST(d.f9_dw004_loc_lmt AS FLOAT64)), 0) AS avg_limit,
      ROUND(SAFE_DIVIDE(SUM(CAST(d.f9_dw004_loc_bal AS FLOAT64)), SUM(CAST(d.f9_dw004_loc_lmt AS FLOAT64) * 100)) * 100, 2) AS utilization_pct,
      COUNTIF(CAST(d.f9_dw004_os_bill_amt AS FLOAT64) > 0) AS with_balance,
      COUNTIF(CAST(d.f9_dw004_os_bill_amt AS FLOAT64) > CAST(d.f9_dw004_curr_min_rpmt AS FLOAT64) AND CAST(d.f9_dw004_curr_min_rpmt AS FLOAT64) > 0) AS revolvers,
      ROUND(SAFE_DIVIDE(
        COUNTIF(CAST(d.f9_dw004_os_bill_amt AS FLOAT64) > CAST(d.f9_dw004_curr_min_rpmt AS FLOAT64) AND CAST(d.f9_dw004_curr_min_rpmt AS FLOAT64) > 0),
        COUNTIF(CAST(d.f9_dw004_os_bill_amt AS FLOAT64) > 0)
      ) * 100, 2) AS revolve_rate_pct,
      ROUND(SUM(CAST(d.f9_dw004_bil_fee_chrg_1 AS FLOAT64) / 100), 0) AS total_fees_idr,
      ROUND(SUM(CAST(d.f9_dw004_bil_chrg_fee AS FLOAT64) / 100), 0) AS total_chrg_fee_idr,
      ROUND(AVG(CAST(d.f9_dw004_cycc_day AS FLOAT64)), 0) AS avg_cycle_day
    FROM acct_map a
    JOIN ${TABLES.financial_account_updates} d ON d.p9_dw004_loc_acct = a.loc_acct
    CROSS JOIN last_date ld
    JOIN cohort_size cs ON a.grp = cs.grp
    WHERE d.f9_dw004_bus_dt = ld.dt
    GROUP BY a.grp, cs.sz
    ORDER BY a.grp
  `;
  return runQuery<CohortFinancialRow>(sql);
}

// ---------------------------------------------------------------------------
// Authoritative Revenue Per User (RPU)
// Combines: actual fees/interest from DW004 + estimated interchange from DW007
// Rates: card interchange 1.6% blended Visa+MC, QRIS 0.2035% (0.55% MDR × 37%)
// Sources: Kansas City Fed Aug 2025, PBI No. 24/8/PBI/2022, PT ALTO Network
// ---------------------------------------------------------------------------

export interface CohortRpuRow {
  grp: string;
  cohort_size: number;
  interest_idr: number;
  admin_fees_idr: number;
  charge_fees_idr: number;
  card_interchange_idr: number;
  qris_revenue_idr: number;
  fee_revenue_idr: number;
  txn_revenue_idr: number;
  total_revenue_idr: number;
  rpu_idr: number;
}

export async function getCohortRpu(startDate: string, endDate: string): Promise<CohortRpuRow[]> {
  const sql = `
    WITH all_users AS (
      SELECT user_id, qris_test_rollout_group AS grp
      FROM ${TABLES.qris_rollout}
    ),
    contaminated_ctrl AS (
      SELECT DISTINCT u.user_id
      FROM all_users u
      JOIN ${TABLES.cms_line_of_credit} m ON u.user_id = m.user_id
      JOIN ${TABLES.principal_card_updates} p ON p.f9_dw005_loc_acct = m.external_id
      JOIN ${TABLES.authorized_transaction} t ON t.f9_dw007_prin_crn = p.f9_dw005_crn
      WHERE u.grp = 'Control'
        AND t.fx_dw007_rte_dest = 'L'
        AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
    ),
    credit_qris_exp AS (
      SELECT user_id, grp FROM all_users
      WHERE NOT (grp = 'Control' AND user_id IN (SELECT user_id FROM contaminated_ctrl))
    ),
    acct_map AS (
      SELECT c.user_id, c.grp, m.external_id AS loc_acct
      FROM credit_qris_exp c
      JOIN ${TABLES.cms_line_of_credit} m ON c.user_id = m.user_id
    ),
    cohort_size AS (
      SELECT grp, COUNT(DISTINCT user_id) AS sz FROM credit_qris_exp GROUP BY grp
    ),
    -- Actual fees + interest from DW004 snapshot on last day of period
    financials AS (
      SELECT a.grp,
        SUM(CAST(d.f9_dw004_tot_int AS FLOAT64) / 100) AS interest_idr,
        SUM(CAST(d.f9_dw004_bil_fee_chrg_1 AS FLOAT64) / 100) AS admin_fees_idr,
        SUM(CAST(d.f9_dw004_bil_chrg_fee AS FLOAT64) / 100) AS charge_fees_idr
      FROM acct_map a
      JOIN ${TABLES.financial_account_updates} d ON d.p9_dw004_loc_acct = a.loc_acct
      WHERE d.f9_dw004_bus_dt = (
        SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt <= @endDate
      )
      GROUP BY a.grp
    ),
    -- Estimated interchange from DW007 transactions in period
    txn_revenue AS (
      SELECT c.grp,
        ROUND(SUM(CASE WHEN t.fx_dw007_rte_dest != 'L' OR t.fx_dw007_rte_dest IS NULL
          THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 * 0.016 ELSE 0 END), 0) AS card_interchange_idr,
        ROUND(SUM(CASE WHEN t.fx_dw007_rte_dest = 'L'
          THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 * 0.002035 ELSE 0 END), 0) AS qris_revenue_idr
      FROM ${TABLES.authorized_transaction} t
      JOIN ${TABLES.principal_card_updates} p ON p.f9_dw005_crn = t.f9_dw007_prin_crn
      JOIN ${TABLES.cms_line_of_credit} m ON m.external_id = p.f9_dw005_loc_acct
      JOIN credit_qris_exp c ON c.user_id = m.user_id
      WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
        AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY c.grp
    )
    SELECT
      f.grp,
      cs.sz AS cohort_size,
      ROUND(f.interest_idr, 0) AS interest_idr,
      ROUND(f.admin_fees_idr, 0) AS admin_fees_idr,
      ROUND(f.charge_fees_idr, 0) AS charge_fees_idr,
      tr.card_interchange_idr,
      tr.qris_revenue_idr,
      ROUND(f.interest_idr + f.admin_fees_idr + f.charge_fees_idr, 0) AS fee_revenue_idr,
      ROUND(tr.card_interchange_idr + tr.qris_revenue_idr, 0) AS txn_revenue_idr,
      ROUND(f.interest_idr + f.admin_fees_idr + f.charge_fees_idr + tr.card_interchange_idr + tr.qris_revenue_idr, 0) AS total_revenue_idr,
      ROUND((f.interest_idr + f.admin_fees_idr + f.charge_fees_idr + tr.card_interchange_idr + tr.qris_revenue_idr) / cs.sz, 0) AS rpu_idr
    FROM financials f
    JOIN txn_revenue tr ON f.grp = tr.grp
    JOIN cohort_size cs ON f.grp = cs.grp
    ORDER BY f.grp
  `;
  return runQuery<CohortRpuRow>(sql, { startDate, endDate });
}

// ---------------------------------------------------------------------------
// Top QRIS-Only Merchants
// ---------------------------------------------------------------------------

export interface TopQrisMerchantRow {
  merchant: string;
  txn_count: number;
  total_spend_idr: number;
  total_spend_usd: number;
}

/** Top 15 QRIS-only merchants by transaction count (all time) */
export async function getTopQrisOnlyMerchantsByTxn(): Promise<TopQrisMerchantRow[]> {
  const sql = `
    WITH qris_only AS (
      SELECT fx_dw007_merc_name AS merchant
      FROM ${TABLES.authorized_transaction}
      WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY merchant
      HAVING MAX(CASE WHEN fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END) = 1
         AND MAX(CASE WHEN fx_dw007_rte_dest != 'L' OR fx_dw007_rte_dest IS NULL THEN 1 ELSE 0 END) = 0
    )
    SELECT
      t.fx_dw007_merc_name AS merchant,
      COUNT(*) AS txn_count,
      ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64) / 100), 0) AS total_spend_idr,
      ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 / 16000), 2) AS total_spend_usd
    FROM ${TABLES.authorized_transaction} t
    JOIN qris_only q ON t.fx_dw007_merc_name = q.merchant
    WHERE (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
      AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
    GROUP BY merchant
    ORDER BY txn_count DESC
    LIMIT 15
  `;
  return runQuery<TopQrisMerchantRow>(sql);
}

/** Top 15 QRIS-only merchants by spend in period */
export async function getTopQrisOnlyMerchantsBySpend(startDate: string, endDate: string): Promise<TopQrisMerchantRow[]> {
  const sql = `
    WITH qris_only AS (
      SELECT fx_dw007_merc_name AS merchant
      FROM ${TABLES.authorized_transaction}
      WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY merchant
      HAVING MAX(CASE WHEN fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END) = 1
         AND MAX(CASE WHEN fx_dw007_rte_dest != 'L' OR fx_dw007_rte_dest IS NULL THEN 1 ELSE 0 END) = 0
    )
    SELECT
      t.fx_dw007_merc_name AS merchant,
      COUNT(*) AS txn_count,
      ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64) / 100), 0) AS total_spend_idr,
      ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 / 16000), 2) AS total_spend_usd
    FROM ${TABLES.authorized_transaction} t
    JOIN qris_only q ON t.fx_dw007_merc_name = q.merchant
    WHERE (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
      AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      AND t.f9_dw007_dt BETWEEN @startDate AND @endDate
    GROUP BY merchant
    ORDER BY total_spend_idr DESC
    LIMIT 15
  `;
  return runQuery<TopQrisMerchantRow>(sql, { startDate, endDate });
}
