import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EligibleAndTransactorsRow {
  week_start: string;
  eligible_count: number;
  transactor_count: number;
  total_transactions: number;
  spend_active_rate: number;
}

export interface SpendMetricsRow {
  week_start: string;
  avg_spend_idr: number;
  avg_spend_usd: number;
  avg_spend_online_idr: number;
  avg_spend_offline_idr: number;
  avg_spend_qris_idr: number;
  total_spend_idr: number;
  total_txn_count: number;
}

export interface NewCustomerActivationRow {
  week_start: string;
  approved_count: number;
  activated_count: number;
  activation_rate_pct: number;
}

export interface DecisionFunnelRow {
  week_start: string;
  total_decisions: number;
  approved: number;
  declined: number;
  waitlisted: number;
  approval_rate_pct: number;
}

export interface DpdBucket {
  label: string;
  count: number;
  exposure_idr: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
}

export interface PortfolioSnapshot {
  total_accounts: number;
  active_accounts: number;
  dpd_buckets: DpdBucket[];
  status_breakdown: StatusBreakdown[];
}

export interface RepaymentVendorBreakdown {
  vendor: string;
  count: number;
  amount: number;
}

export interface RepaymentMetricsRow {
  week_start: string;
  total_repayments: number;
  total_amount: number;
  avg_amount: number;
  vendor_breakdown: RepaymentVendorBreakdown[];
}

// ---------------------------------------------------------------------------
// 1. Eligible & Transactors
// ---------------------------------------------------------------------------

export async function getEligibleAndTransactors(
  startDate: Date,
  endDate: Date,
): Promise<EligibleAndTransactorsRow[]> {
  const sql = `
    WITH card_unblocked AS (
      SELECT DISTINCT f9_dw005_loc_acct AS loc_acct
      FROM ${TABLES.principal_card_updates}
      WHERE f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL
        AND TRIM(CAST(f9_dw005_1st_unblk_all_mtd_tms AS STRING)) != ''
        AND f9_dw005_hce_txn_ind LIKE '%0%'
        AND f9_dw005_net_txn_ind LIKE '%0%'
        AND fx_dw005_contc_less_flg LIKE '%Y%'
        AND f9_dw005_contc_txn_ind LIKE '%0%'
    ),

    weekly_eligible AS (
      SELECT
        DATE_TRUNC(dw4.f9_dw004_bus_dt, ISOWEEK) AS week_start,
        COUNT(DISTINCT dw4.p9_dw004_loc_acct) AS eligible_count
      FROM ${TABLES.financial_account_updates} dw4
      JOIN card_unblocked cu
        ON dw4.p9_dw004_loc_acct = cu.loc_acct
      WHERE dw4.f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND EXTRACT(DAYOFWEEK FROM dw4.f9_dw004_bus_dt) = 1
        AND dw4.fx_dw004_loc_stat IN ('G', 'N')
        AND dw4.f9_dw004_curr_dpd >= 0
        -- All product types included (prepaid + opening fee no longer excluded)
      GROUP BY week_start
    ),

    card_acct_map AS (
      SELECT DISTINCT
        f9_dw005_crn AS crn,
        f9_dw005_loc_acct AS loc_acct
      FROM ${TABLES.principal_card_updates}
    ),

    weekly_transactors AS (
      SELECT
        DATE_TRUNC(dw7.f9_dw007_dt, ISOWEEK) AS week_start,
        COUNT(DISTINCT cam.loc_acct) AS transactor_count,
        COUNT(*) AS total_transactions
      FROM ${TABLES.authorized_transaction} dw7
      JOIN card_acct_map cam
        ON dw7.f9_dw007_prin_crn = cam.crn
      WHERE dw7.f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
        AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        -- All product types included (prepaid + opening fee no longer excluded)
      GROUP BY week_start
    )

    SELECT
      FORMAT_DATE('%Y-%m-%d', e.week_start) AS week_start,
      e.eligible_count,
      COALESCE(t.transactor_count, 0) AS transactor_count,
      COALESCE(t.total_transactions, 0) AS total_transactions,
      ROUND(SAFE_DIVIDE(COALESCE(t.transactor_count, 0), e.eligible_count) * 100, 2) AS spend_active_rate
    FROM weekly_eligible e
    LEFT JOIN weekly_transactors t
      ON e.week_start = t.week_start
    ORDER BY e.week_start
  `;

  return runQuery<EligibleAndTransactorsRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Spend Metrics
// ---------------------------------------------------------------------------

export async function getSpendMetrics(
  startDate: Date,
  endDate: Date,
): Promise<SpendMetricsRow[]> {
  const sql = `
    WITH valid_spend AS (
      SELECT
        DATE_TRUNC(dw7.f9_dw007_dt, ISOWEEK) AS week_start,
        dw7.fx_dw007_txn_typ AS txn_typ,
        dw7.fx_dw007_rte_dest AS rte_dest,
        dw7.f9_dw007_amt_req / 100.0 AS amt_idr,
        COALESCE(dw9.f9_dw009_setl_amt / 100.0 / 16000.0, 0) AS amt_usd
      FROM ${TABLES.authorized_transaction} dw7
      LEFT JOIN ${TABLES.posted_transaction} dw9
        ON dw7.fx_dw007_txn_id = dw9.fx_dw009_txn_id
       AND dw7.fx_dw007_given_apv_cde = dw9.fx_dw009_apv_cde
      WHERE dw7.f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
        AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND dw7.f9_dw007_ori_amt > 0
    )

    SELECT
      FORMAT_DATE('%Y-%m-%d', week_start) AS week_start,
      ROUND(AVG(amt_idr), 0) AS avg_spend_idr,
      ROUND(AVG(amt_usd), 2) AS avg_spend_usd,
      ROUND(AVG(CASE WHEN txn_typ = 'TM' THEN amt_idr END), 0) AS avg_spend_online_idr,
      ROUND(AVG(CASE
        WHEN txn_typ != 'TM'
         AND NOT (txn_typ = 'RA' AND rte_dest = 'L')
        THEN amt_idr
      END), 0) AS avg_spend_offline_idr,
      ROUND(AVG(CASE
        WHEN txn_typ = 'RA' AND rte_dest = 'L'
        THEN amt_idr
      END), 0) AS avg_spend_qris_idr,
      ROUND(SUM(amt_idr), 0) AS total_spend_idr,
      COUNT(*) AS total_txn_count
    FROM valid_spend
    GROUP BY week_start
    ORDER BY week_start
  `;

  return runQuery<SpendMetricsRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 3. New Customer Activation Rate
// ---------------------------------------------------------------------------

export async function getNewCustomerActivationRate(
  startDate: Date,
  endDate: Date,
): Promise<NewCustomerActivationRow[]> {
  const sql = `
    WITH approved_users AS (
      SELECT
        user_id,
        DATE(MIN(timestamp), 'Asia/Jakarta') AS approval_date
      FROM ${TABLES.decision_completed}
      WHERE decision = 'APPROVED'
        -- All product types included (prepaid + opening fee no longer excluded)
      GROUP BY user_id
    ),

    user_crn AS (
      SELECT
        au.user_id,
        au.approval_date,
        dw4.p9_dw004_prin_crn AS crn,
        ROW_NUMBER() OVER (PARTITION BY au.user_id ORDER BY dw4.p9_dw004_prin_crn) AS rn
      FROM approved_users au
      JOIN ${TABLES.cms_line_of_credit} cloc
        ON au.user_id = cloc.user_id
      JOIN ${TABLES.financial_account_updates} dw4
        ON cloc.external_id = dw4.p9_dw004_loc_acct
    ),

    cohort AS (
      SELECT
        user_id,
        approval_date,
        crn
      FROM user_crn
      WHERE rn = 1
    ),

    weekly_cohort AS (
      SELECT
        DATE_TRUNC(approval_date, ISOWEEK) AS week_start,
        user_id,
        approval_date,
        crn
      FROM cohort
      WHERE DATE_TRUNC(approval_date, ISOWEEK) BETWEEN @startDate AND @endDate
    ),

    activated AS (
      SELECT DISTINCT wc.user_id
      FROM weekly_cohort wc
      JOIN ${TABLES.authorized_transaction} dw7
        ON wc.crn = dw7.f9_dw007_prin_crn
       AND dw7.f9_dw007_dt BETWEEN wc.approval_date AND DATE_ADD(wc.approval_date, INTERVAL 7 DAY)
      WHERE (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
        AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
    )

    SELECT
      FORMAT_DATE('%Y-%m-%d', wc.week_start) AS week_start,
      COUNT(DISTINCT wc.user_id) AS approved_count,
      COUNT(DISTINCT a.user_id) AS activated_count,
      ROUND(SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT wc.user_id)) * 100, 2) AS activation_rate_pct
    FROM weekly_cohort wc
    LEFT JOIN activated a
      ON wc.user_id = a.user_id
    WHERE DATE_ADD(wc.week_start, INTERVAL 13 DAY) <= CURRENT_DATE()
    GROUP BY wc.week_start
    ORDER BY wc.week_start
  `;

  return runQuery<NewCustomerActivationRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 4. Decision Funnel
// ---------------------------------------------------------------------------

export async function getDecisionFunnel(
  startDate: Date,
  endDate: Date,
): Promise<DecisionFunnelRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
      COUNT(*) AS total_decisions,
      COUNTIF(decision = 'APPROVED') AS approved,
      COUNTIF(decision = 'DECLINED') AS declined,
      COUNTIF(decision = 'WAITLISTED') AS waitlisted,
      ROUND(SAFE_DIVIDE(COUNTIF(decision = 'APPROVED'), COUNT(*)) * 100, 2) AS approval_rate_pct
    FROM ${TABLES.decision_completed}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY week_start
    ORDER BY week_start
  `;

  return runQuery<DecisionFunnelRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 5. Portfolio Snapshot
// ---------------------------------------------------------------------------

export async function getPortfolioSnapshot(
  date: Date,
): Promise<PortfolioSnapshot> {
  const dpdSql = `
    SELECT
      CASE
        WHEN f9_dw004_curr_dpd = 0 THEN 'Current'
        WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30 DPD'
        WHEN f9_dw004_curr_dpd BETWEEN 31 AND 60 THEN '31-60 DPD'
        WHEN f9_dw004_curr_dpd BETWEEN 61 AND 90 THEN '61-90 DPD'
        WHEN f9_dw004_curr_dpd > 90 THEN '90+ DPD'
      END AS label,
      COUNT(DISTINCT p9_dw004_loc_acct) AS count,
      ROUND(SUM(f9_dw004_clo_bal / 100.0), 0) AS exposure_idr
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt = @snapshotDate
      AND f9_dw004_curr_dpd >= 0
    GROUP BY label
    ORDER BY
      CASE label
        WHEN 'Current' THEN 1
        WHEN '1-30 DPD' THEN 2
        WHEN '31-60 DPD' THEN 3
        WHEN '61-90 DPD' THEN 4
        WHEN '90+ DPD' THEN 5
      END
  `;

  const statusSql = `
    SELECT
      fx_dw004_loc_stat AS status,
      COUNT(DISTINCT p9_dw004_loc_acct) AS count
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt = @snapshotDate
    GROUP BY status
    ORDER BY count DESC
  `;

  const summarySql = `
    SELECT
      COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts,
      COUNT(DISTINCT CASE WHEN fx_dw004_loc_stat IN ('G', 'N') THEN p9_dw004_loc_acct END) AS active_accounts
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt = @snapshotDate
  `;

  const snapshotDate = toSqlDate(date);

  const [dpdRows, statusRows, summaryRows] = await Promise.all([
    runQuery<DpdBucket>(dpdSql, { snapshotDate }),
    runQuery<StatusBreakdown>(statusSql, { snapshotDate }),
    runQuery<{ total_accounts: number; active_accounts: number }>(summarySql, { snapshotDate }),
  ]);

  const summary = summaryRows[0] ?? { total_accounts: 0, active_accounts: 0 };

  return {
    total_accounts: summary.total_accounts,
    active_accounts: summary.active_accounts,
    dpd_buckets: dpdRows,
    status_breakdown: statusRows,
  };
}

// ---------------------------------------------------------------------------
// 6. Repayment Metrics
// ---------------------------------------------------------------------------

export async function getRepaymentMetrics(
  startDate: Date,
  endDate: Date,
): Promise<RepaymentMetricsRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
      COUNT(*) AS total_repayments,
      ROUND(SUM(amount / 100.0), 0) AS total_amount,
      ROUND(AVG(amount / 100.0), 0) AS avg_amount,
      ARRAY_AGG(STRUCT(
        vendor,
        vendor_count AS count,
        vendor_amount AS amount
      )) AS vendor_breakdown
    FROM (
      SELECT
        timestamp,
        amount,
        vendor,
        COUNT(*) OVER (PARTITION BY DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK), vendor) AS vendor_count,
        ROUND(SUM(amount / 100.0) OVER (PARTITION BY DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK), vendor), 0) AS vendor_amount,
        ROW_NUMBER() OVER (PARTITION BY DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK), vendor ORDER BY timestamp) AS rn
      FROM ${TABLES.repayment_completed}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    )
    WHERE rn = 1
    GROUP BY week_start
    ORDER BY week_start
  `;

  return runQuery<RepaymentMetricsRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
