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
// Types — Weekly Spend Trend
// ---------------------------------------------------------------------------

export interface WeeklySpendTrendRow {
  week_start: string;
  eligible_count: number;
  transactor_count: number;
  total_transactions: number;
  total_spend_idr: number;
  spend_active_rate: number;
  online_spend_idr: number;
  offline_spend_idr: number;
  qris_spend_idr: number;
  avg_spend_per_txn_idr: number;
}

// ---------------------------------------------------------------------------
// 0. Weekly Spend Trend — eligible, transactors, spend, SAR
// ---------------------------------------------------------------------------

export async function getWeeklySpendTrend(startDate: Date, endDate: Date): Promise<WeeklySpendTrendRow[]> {
  const sql = `
    WITH
    -- 1. Exclude RP1 and Registration Fee users
    excluded_users AS (
      SELECT DISTINCT m.external_id AS loc_acct
      FROM ${TABLES.decision_completed} d
      JOIN ${TABLES.cms_line_of_credit} m ON d.user_id = m.user_id
      WHERE IFNULL(d.is_prepaid_card_applicable, FALSE) IS TRUE
         OR IFNULL(d.is_account_opening_fee_applicable, FALSE) IS TRUE
    ),
    -- 2. Cards unblocked & enabled for contactless/NFC/etc.
    card_unblocked AS (
      SELECT DISTINCT f9_dw005_loc_acct AS loc_acct
      FROM ${TABLES.principal_card_updates}
      WHERE f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL
        AND TRIM(CAST(f9_dw005_1st_unblk_all_mtd_tms AS STRING)) != ''
        AND (fx_dw005_crd_stat IS NULL OR TRIM(CAST(fx_dw005_crd_stat AS STRING)) != '')
        AND f9_dw005_hce_txn_ind LIKE '%0%'
        AND f9_dw005_net_txn_ind LIKE '%0%'
        AND fx_dw005_contc_less_flg LIKE '%Y%'
        AND f9_dw005_contc_txn_ind LIKE '%0%'
    ),
    -- 3. Eligible users per week (Sunday snapshot of Mon-Sun week)
    weekly_eligible AS (
      SELECT
        DATE_TRUNC(a.f9_dw004_bus_dt, WEEK(MONDAY)) AS week_start,
        COUNT(DISTINCT a.p9_dw004_loc_acct) AS eligible_count
      FROM ${TABLES.financial_account_updates} a
      JOIN card_unblocked c ON a.p9_dw004_loc_acct = c.loc_acct
      WHERE EXTRACT(DAYOFWEEK FROM a.f9_dw004_bus_dt) = 1
        AND a.fx_dw004_loc_stat IN ('G', 'N')
        AND a.f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND a.f9_dw004_curr_dpd >= 0
        AND a.p9_dw004_loc_acct NOT IN (SELECT loc_acct FROM excluded_users)
      GROUP BY week_start
    ),
    -- 4. CRN → loc_acct mapping
    card_acct_map AS (
      SELECT DISTINCT f9_dw005_crn AS crn, f9_dw005_loc_acct AS loc_acct
      FROM ${TABLES.principal_card_updates}
    ),
    -- 5. Weekly transactors & transaction counts
    weekly_transactors AS (
      SELECT
        DATE_TRUNC(t.f9_dw007_dt, WEEK(MONDAY)) AS week_start,
        COUNT(DISTINCT cam.loc_acct) AS transactor_count,
        COUNT(*) AS total_transactions,
        ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64) / 100), 2) AS total_spend_idr,
        ROUND(SUM(CASE WHEN t.fx_dw007_txn_typ = 'TM' THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 ELSE 0 END), 2) AS online_spend_idr,
        ROUND(SUM(CASE WHEN t.fx_dw007_txn_typ != 'TM' AND NOT (t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L') THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 ELSE 0 END), 2) AS offline_spend_idr,
        ROUND(SUM(CASE WHEN t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L' THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 ELSE 0 END), 2) AS qris_spend_idr
      FROM ${TABLES.authorized_transaction} t
      JOIN card_acct_map cam ON t.f9_dw007_prin_crn = cam.crn
      WHERE (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
        AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND t.f9_dw007_dt BETWEEN @startDate AND @endDate
      GROUP BY week_start
    )
    SELECT
      FORMAT_DATE('%Y-%m-%d', e.week_start) AS week_start,
      e.eligible_count,
      COALESCE(t.transactor_count, 0) AS transactor_count,
      COALESCE(t.total_transactions, 0) AS total_transactions,
      ROUND(COALESCE(t.total_spend_idr, 0), 2) AS total_spend_idr,
      ROUND(SAFE_DIVIDE(COALESCE(t.transactor_count, 0), e.eligible_count) * 100, 2) AS spend_active_rate,
      ROUND(COALESCE(t.online_spend_idr, 0), 2) AS online_spend_idr,
      ROUND(COALESCE(t.offline_spend_idr, 0), 2) AS offline_spend_idr,
      ROUND(COALESCE(t.qris_spend_idr, 0), 2) AS qris_spend_idr,
      ROUND(SAFE_DIVIDE(COALESCE(t.total_spend_idr, 0), NULLIF(COALESCE(t.total_transactions, 0), 0)), 2) AS avg_spend_per_txn_idr
    FROM weekly_eligible e
    LEFT JOIN weekly_transactors t USING (week_start)
    ORDER BY e.week_start
  `;

  return runQuery<WeeklySpendTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 0b. Period-level Spend Summary — cumulative SAR for the entire period
// ---------------------------------------------------------------------------

export interface PeriodSpendSummary {
  eligible_count: number;
  transactor_count: number;
  total_transactions: number;
  total_spend_idr: number;
  spend_active_rate: number;
  avg_spend_per_txn_idr: number;
}

export async function getPeriodSpendSummary(startDate: Date, endDate: Date): Promise<PeriodSpendSummary | null> {
  const sql = `
    WITH
    -- 1. Exclude RP1 and Registration Fee users
    excluded_users AS (
      SELECT DISTINCT m.external_id AS loc_acct
      FROM ${TABLES.decision_completed} d
      JOIN ${TABLES.cms_line_of_credit} m ON d.user_id = m.user_id
      WHERE IFNULL(d.is_prepaid_card_applicable, FALSE) IS TRUE
         OR IFNULL(d.is_account_opening_fee_applicable, FALSE) IS TRUE
    ),
    -- 2. Cards unblocked & enabled
    card_unblocked AS (
      SELECT DISTINCT f9_dw005_loc_acct AS loc_acct
      FROM ${TABLES.principal_card_updates}
      WHERE f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL
        AND TRIM(CAST(f9_dw005_1st_unblk_all_mtd_tms AS STRING)) != ''
        AND (fx_dw005_crd_stat IS NULL OR TRIM(CAST(fx_dw005_crd_stat AS STRING)) != '')
        AND f9_dw005_hce_txn_ind LIKE '%0%'
        AND f9_dw005_net_txn_ind LIKE '%0%'
        AND fx_dw005_contc_less_flg LIKE '%Y%'
        AND f9_dw005_contc_txn_ind LIKE '%0%'
    ),
    -- 3. Eligible: snapshot on the last available date in the period
    eligible AS (
      SELECT COUNT(DISTINCT a.p9_dw004_loc_acct) AS cnt
      FROM ${TABLES.financial_account_updates} a
      JOIN card_unblocked c ON a.p9_dw004_loc_acct = c.loc_acct
      WHERE a.f9_dw004_bus_dt = (
        SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates} WHERE f9_dw004_bus_dt <= @endDate
      )
        AND a.fx_dw004_loc_stat IN ('G', 'N')
        AND a.f9_dw004_curr_dpd >= 0
        AND a.p9_dw004_loc_acct NOT IN (SELECT loc_acct FROM excluded_users)
    ),
    -- 4. CRN → loc_acct mapping
    card_acct_map AS (
      SELECT DISTINCT f9_dw005_crn AS crn, f9_dw005_loc_acct AS loc_acct
      FROM ${TABLES.principal_card_updates}
    ),
    -- 5. Transactors: distinct accounts with >=1 valid txn in the ENTIRE period
    transactors AS (
      SELECT
        COUNT(DISTINCT cam.loc_acct) AS cnt,
        COUNT(*) AS total_txns,
        ROUND(SUM(CAST(dw7.f9_dw007_amt_req AS FLOAT64) / 100), 2) AS total_spend
      FROM ${TABLES.authorized_transaction} dw7
      JOIN card_acct_map cam ON dw7.f9_dw007_prin_crn = cam.crn
      WHERE (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '')
        AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND dw7.f9_dw007_dt BETWEEN @startDate AND @endDate
    )
    SELECT
      e.cnt AS eligible_count,
      t.cnt AS transactor_count,
      t.total_txns AS total_transactions,
      t.total_spend AS total_spend_idr,
      ROUND(SAFE_DIVIDE(t.cnt, e.cnt) * 100, 2) AS spend_active_rate,
      ROUND(SAFE_DIVIDE(t.total_spend, NULLIF(t.total_txns, 0)), 2) AS avg_spend_per_txn_idr
    FROM eligible e, transactors t
  `;

  const rows = await runQuery<PeriodSpendSummary>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
  return rows[0] ?? null;
}

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
