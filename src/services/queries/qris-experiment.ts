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
