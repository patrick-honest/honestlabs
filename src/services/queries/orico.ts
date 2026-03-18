/**
 * Orico Report Queries
 * ---------------------------------------------------------------------------
 * These queries power the Orico partner reporting section.
 * All queries target BigQuery project `storage-58f5a02c` (asia-southeast2).
 *
 * Segments:
 *   - Regular: is_account_opening_fee_applicable = false AND is_prepaid_card_applicable = false
 *   - RP1:     is_prepaid_card_applicable = true (or F9_DW001_LOC_LMT = 1)
 *   - AOF:     is_account_opening_fee_applicable = true
 * ---------------------------------------------------------------------------
 */

import { runQuery } from "@/lib/bigquery";
import type { QueryInfo } from "@/components/query-inspector/query-inspector";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApprovedBySegmentRow {
  month_key: string;
  segment: string;
  total_approved: number;
}

export interface AcceptedCumulativeRow {
  month_key: string;
  segment: string;
  total_accepted_user: number;
  cumul_accepted_user: number;
}

export interface ActivePortfolioRow {
  month_key: string;
  segment: string;
  total_account: number;
}

export interface PortfolioSummaryRow {
  reporting_date_month: string;
  segment: string;       // risk segment (A/B/C/D)
  product_segment: string; // Regular/RP1/AOF
  total_newly_account: number;
  total_newly_limit: number;
  cum_booked_customer: number;
}

export interface ProvisionRow {
  segment: string;
  provision: number;
  undrawn_limit: number;
}

export interface Rp1TopupRow {
  reporting_date_day: string;
  total_account_rp1: number;
  total_topup_rp1: number;
}

export interface OnboardingFunnelRow {
  month_onboard: string;
  segment: string;
  total_onboard: number;
  total_accepted_user: number;
  cum_total_onboard: number;
  cum_total_accepted_user: number;
}

// ── Query 1: Approved Applications by Segment ────────────────────────────────

const APPROVED_BY_SEGMENT_SQL = `
SELECT
  DATE_TRUNC(date_decision, MONTH) AS month_key,
  CASE
    WHEN is_account_opening_fee_applicable = FALSE AND is_prepaid_card_applicable = FALSE THEN 'Regular'
    WHEN is_prepaid_card_applicable = TRUE THEN 'RP1'
    WHEN is_account_opening_fee_applicable = TRUE THEN 'AOF'
    ELSE 'Regular'
  END AS segment,
  COUNT(DISTINCT CASE WHEN decision = 'APPROVED' THEN application_status_id END) AS total_approved
FROM \`sandbox_risk.ft_application_decision_base\`
GROUP BY 1, 2
ORDER BY 1, 2
`;

export function getApprovedBySegmentQuery(): QueryInfo {
  return {
    title: "Orico: Approved by Segment",
    sql: APPROVED_BY_SEGMENT_SQL,
    params: [],
  };
}

export async function getApprovedBySegment(): Promise<ApprovedBySegmentRow[]> {
  return runQuery<ApprovedBySegmentRow>(APPROVED_BY_SEGMENT_SQL);
}

// ── Query 2: Accepted Users (Signed Contract) with Cumulative ────────────────

const ACCEPTED_CUMULATIVE_SQL = `
WITH T1 AS (
  SELECT *,
    PARSE_DATETIME('%Y-%m-%d %H:%M:%S',
      CONCAT(
        SPLIT(signed_contract_file, '_')[SAFE_OFFSET(0)], " ",
        SPLIT(signed_contract_file, '_')[SAFE_OFFSET(1)], ':',
        SPLIT(signed_contract_file, '_')[SAFE_OFFSET(2)], ':',
        SPLIT(signed_contract_file, '_')[SAFE_OFFSET(3)]
      )
    ) AS timestamp_accepted,
    SPLIT(signed_contract_file, '_')[SAFE_OFFSET(4)] AS contract_id,
    SPLIT(signed_contract_file, '_')[SAFE_OFFSET(5)] AS user_id,
    SPLIT(signed_contract_file, '_')[SAFE_OFFSET(6)] AS signed_part
  FROM \`storage-58f5a02c.refined_contract_generation_service.customer_contract_generated\`
  WHERE signed_contract_file <> '' AND signed_contract_file IS NOT NULL
),
summary AS (
  SELECT
    DATE_TRUNC(DATE(TIMESTAMP_ADD(a.timestamp_accepted, INTERVAL 7 HOUR)), MONTH) AS month_key,
    CASE
      WHEN is_account_opening_fee_applicable = FALSE AND is_prepaid_card_applicable = FALSE THEN 'Regular'
      WHEN is_account_opening_fee_applicable = TRUE THEN 'AOF'
      WHEN is_prepaid_card_applicable = TRUE THEN 'RP1'
      ELSE 'Regular'
    END AS segment,
    COUNT(DISTINCT b.user_id) AS total_accepted_user
  FROM T1 a
  LEFT JOIN \`sandbox_risk.ft_application_decision_base\` b ON a.user_id = b.user_id
  WHERE decision = 'APPROVED'
  GROUP BY 1, 2
)
SELECT
  month_key,
  segment,
  total_accepted_user,
  SUM(total_accepted_user) OVER (PARTITION BY segment ORDER BY month_key ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumul_accepted_user
FROM summary
ORDER BY 1
`;

export function getAcceptedCumulativeQuery(): QueryInfo {
  return {
    title: "Orico: Accepted Users (Cumulative)",
    sql: ACCEPTED_CUMULATIVE_SQL,
    params: [],
  };
}

export async function getAcceptedCumulative(): Promise<AcceptedCumulativeRow[]> {
  return runQuery<AcceptedCumulativeRow>(ACCEPTED_CUMULATIVE_SQL);
}

// ── Query 3: Active Portfolio (dpd_bi < 7) ───────────────────────────────────

const ACTIVE_PORTFOLIO_SQL = `
WITH T1 AS (
  SELECT
    DATE_TRUNC(reporting_date_day, MONTH) AS month_key,
    P9_DW004_LOC_ACCT,
    CASE
      WHEN is_account_opening_fee_applicable = FALSE AND is_prepaid_card_applicable = FALSE THEN 'Regular'
      WHEN (is_prepaid_card_applicable = TRUE OR F9_DW001_LOC_LMT = 1) THEN 'RP1'
      WHEN is_account_opening_fee_applicable = TRUE THEN 'AOF'
      ELSE 'Regular'
    END AS segment,
    ROW_NUMBER() OVER (PARTITION BY P9_DW004_LOC_ACCT, reporting_date_day) AS rk
  FROM \`sandbox_finance.dim_daily_portfolio\` a
  LEFT JOIN \`sandbox_finance.dim_map_application_locacct\` b ON a.P9_DW004_LOC_ACCT = b.loc
  LEFT JOIN \`sandbox_risk.ft_application_decision_base\` c ON b.guid = c.user_id
  WHERE reporting_date_day = LAST_DAY(reporting_date_day, MONTH)
    AND dpd_bi < 7
  QUALIFY rk = 1
)
SELECT
  month_key,
  segment,
  COUNT(DISTINCT P9_DW004_LOC_ACCT) AS total_account
FROM T1
GROUP BY 1, 2
ORDER BY 1, 2
`;

export function getActivePortfolioQuery(): QueryInfo {
  return {
    title: "Orico: Active Portfolio",
    sql: ACTIVE_PORTFOLIO_SQL,
    params: [],
  };
}

export async function getActivePortfolio(): Promise<ActivePortfolioRow[]> {
  return runQuery<ActivePortfolioRow>(ACTIVE_PORTFOLIO_SQL);
}

// ── Query 4: Portfolio Summary (newly booked, limits, cumulative) ────────────

const PORTFOLIO_SUMMARY_SQL = `
WITH portfolio_agg_customer AS (
  SELECT DISTINCT a.*, unblock_date,
    d.credit_risk_category AS segment,
    d.is_account_opening_fee_applicable,
    is_prepaid_card_applicable
  FROM \`storage-58f5a02c.sandbox_finance.dim_daily_portfolio\` a
  JOIN \`sandbox_finance.dim_booked_customer\` b
    ON a.P9_DW004_LOC_ACCT = b.F9_DW005_LOC_ACCT
    AND b.unblock_date <= a.reporting_date_day
  LEFT JOIN \`sandbox_finance.dim_map_application_locacct\` c ON b.F9_DW005_LOC_ACCT = c.loc
  LEFT JOIN \`sandbox_risk.ft_application_decision_base\` d ON c.application_status_id = d.application_status_id
  WHERE b.card_type <> 'Unidentified'
)
SELECT DISTINCT
  DATE_TRUNC(a.reporting_date_day, MONTH) AS reporting_date_month,
  CASE
    WHEN segment IN ("D","E","F","G","Z","wtf") OR segment IS NULL THEN 'D'
    ELSE segment
  END AS segment,
  CASE
    WHEN is_account_opening_fee_applicable = FALSE AND is_prepaid_card_applicable = FALSE THEN 'Regular'
    WHEN (is_prepaid_card_applicable = TRUE OR F9_DW001_LOC_LMT = 1) THEN 'RP1'
    WHEN is_account_opening_fee_applicable = TRUE THEN 'AOF'
    ELSE 'Regular'
  END AS product_segment,
  COUNT(DISTINCT CASE WHEN DATE_TRUNC(unblock_date, MONTH) = DATE_TRUNC(a.reporting_date_day, MONTH) THEN a.P9_DW004_LOC_ACCT END) AS total_newly_account,
  SUM(CASE WHEN DATE_TRUNC(unblock_date, MONTH) = DATE_TRUNC(a.reporting_date_day, MONTH) AND is_prepaid_card_applicable <> TRUE THEN F9_DW004_LOC_LMT ELSE 0 END) AS total_newly_limit,
  COUNT(DISTINCT CASE WHEN dpd_bi < 7 THEN P9_DW004_LOC_ACCT END) AS cum_booked_customer
FROM portfolio_agg_customer a
WHERE (a.reporting_date_day = LAST_DAY(a.reporting_date_day, MONTH) OR a.reporting_date_day = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY))
GROUP BY 1, 2, 3
ORDER BY 1, 3, 2
`;

export function getPortfolioSummaryQuery(): QueryInfo {
  return {
    title: "Orico: Portfolio Summary",
    sql: PORTFOLIO_SUMMARY_SQL,
    params: [],
  };
}

export async function getPortfolioSummary(): Promise<PortfolioSummaryRow[]> {
  return runQuery<PortfolioSummaryRow>(PORTFOLIO_SUMMARY_SQL);
}

// ── Query 5: Provision & Undrawn Limit ───────────────────────────────────────

function buildProvisionSql(reportDate: string): string {
  return `
WITH T1 AS (
  SELECT DISTINCT P9_DW004_LOC_ACCT,
    CASE
      WHEN is_account_opening_fee_applicable = TRUE THEN 'AOF'
      WHEN is_prepaid_card_applicable = TRUE THEN 'RP1'
      ELSE 'Regular'
    END AS segment,
    ROUND(CASE
      WHEN dpd_bi = 0 THEN 0.146688334554325
      WHEN dpd_bi = 1 THEN 0.905088874235295
      WHEN dpd_bi = 2 THEN 0.952732823380575
      WHEN dpd_bi = 3 THEN 0.95491466785441
      WHEN dpd_bi < 7 THEN 1
      ELSE 0
    END * FLOOR(F9_DW004_CLO_BAL), 0) AS provision,
    CASE
      WHEN dpd_bi < 3 AND PERMANENT_BLOCK_DPD IS NULL AND F9_DW004_CLO_BAL > 0
        THEN GREATEST(f9_dw004_avail_bal, 0) ELSE 0
    END * 0.777156059098383 * 0.0733441672771623 AS undrawn_limit
  FROM \`sandbox_finance.dim_daily_portfolio\` b
  LEFT JOIN \`sandbox_finance.dim_map_application_locacct\` c ON b.P9_DW004_LOC_ACCT = c.loc
  LEFT JOIN \`sandbox_risk.ft_application_decision_base\` d ON c.application_status_id = d.application_status_id
  WHERE dpd_bi < 7
    AND reporting_date_day = '${reportDate}'
)
SELECT
  segment,
  SUM(provision) AS provision,
  SUM(undrawn_limit) AS undrawn_limit
FROM T1
GROUP BY 1
`;
}

export function getProvisionQuery(reportDate: string): QueryInfo {
  return {
    title: "Orico: Provision & Undrawn Limit",
    sql: buildProvisionSql(reportDate),
    params: [{ name: "report_date", value: reportDate, type: "DATE" as const }],
  };
}

export async function getProvision(reportDate: string): Promise<ProvisionRow[]> {
  return runQuery<ProvisionRow>(buildProvisionSql(reportDate));
}

// ── Query 6: RP1 Top-up Rate ─────────────────────────────────────────────────

const RP1_TOPUP_SQL = `
WITH made_payment AS (
  SELECT
    fx_dw009_loc_acct,
    f9_dw009_txn_dt,
    SUM(f9_dw009_setl_amt) OVER (PARTITION BY fx_dw009_loc_acct ORDER BY f9_dw009_upd_tms) / 100 * -1 AS total_repayment
  FROM \`refined_finexus.posted_transaction\` t1
  WHERE f9_dw009_txn_cde IN ('4111', '4621', '4631')
)
SELECT
  reporting_date_day,
  COUNT(DISTINCT a.P9_DW004_LOC_ACCT) AS total_account_rp1,
  COUNT(DISTINCT CASE WHEN DATE_TRUNC(a.f9_dw001_appl_rcv_dt, MONTH) <= DATE_TRUNC(f9_dw009_txn_dt, MONTH) THEN P9_DW004_LOC_ACCT END) AS total_topup_rp1
FROM \`sandbox_finance.dim_daily_portfolio\` a
LEFT JOIN (
  SELECT * FROM made_payment
  QUALIFY ROW_NUMBER() OVER (PARTITION BY fx_dw009_loc_acct ORDER BY f9_dw009_txn_dt) = 1
) b ON a.P9_DW004_LOC_ACCT = b.fx_dw009_loc_acct
  AND f9_dw001_appl_rcv_dt <= b.f9_dw009_txn_dt
  AND a.reporting_date_day >= b.f9_dw009_txn_dt
WHERE a.f9_dw001_loc_lmt = 1 AND dpd_bi < 7
  AND (reporting_date_day = LAST_DAY(reporting_date_day, MONTH) OR reporting_date_day = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY))
GROUP BY 1
ORDER BY 1
`;

export function getRp1TopupQuery(): QueryInfo {
  return {
    title: "Orico: RP1 Top-up Rate",
    sql: RP1_TOPUP_SQL,
    params: [],
  };
}

export async function getRp1Topup(): Promise<Rp1TopupRow[]> {
  return runQuery<Rp1TopupRow>(RP1_TOPUP_SQL);
}

// ── Query 7: Onboarding Funnel (Approved → Accepted → Card Issued) ──────────

const ONBOARDING_FUNNEL_SQL = `
WITH T1 AS (
  SELECT *,
    PARSE_DATETIME('%Y-%m-%d %H:%M:%S',
      CONCAT(
        SPLIT(signed_contract_file, '_')[SAFE_OFFSET(0)], " ",
        SPLIT(signed_contract_file, '_')[SAFE_OFFSET(1)], ':',
        SPLIT(signed_contract_file, '_')[SAFE_OFFSET(2)], ':',
        SPLIT(signed_contract_file, '_')[SAFE_OFFSET(3)]
      )
    ) AS timestamp_accepted,
    SPLIT(signed_contract_file, '_')[SAFE_OFFSET(4)] AS contract_id,
    SPLIT(signed_contract_file, '_')[SAFE_OFFSET(5)] AS user_id,
    SPLIT(signed_contract_file, '_')[SAFE_OFFSET(6)] AS signed_part
  FROM \`storage-58f5a02c.refined_contract_generation_service.customer_contract_generated\`
  WHERE signed_contract_file <> '' AND signed_contract_file IS NOT NULL
),
acceptance AS (
  SELECT
    DATE_TRUNC(DATE(TIMESTAMP_ADD(a.timestamp_accepted, INTERVAL 7 HOUR)), MONTH) AS month_key,
    CASE
      WHEN is_account_opening_fee_applicable = FALSE AND is_prepaid_card_applicable = FALSE THEN 'Regular'
      WHEN is_prepaid_card_applicable = TRUE THEN 'RP1'
      WHEN is_account_opening_fee_applicable = TRUE THEN 'AOF'
      ELSE 'Regular'
    END AS segment,
    COUNT(DISTINCT b.user_id) AS total_accepted_user
  FROM T1 a
  LEFT JOIN \`sandbox_risk.ft_application_decision_base\` b ON a.user_id = b.user_id
  WHERE decision = 'APPROVED'
  GROUP BY 1, 2
),
T2 AS (
  SELECT
    DATE_TRUNC(date_decision, MONTH) AS month_onboard,
    CASE
      WHEN is_account_opening_fee_applicable = FALSE AND is_prepaid_card_applicable = FALSE THEN 'Regular'
      WHEN is_prepaid_card_applicable = TRUE THEN 'RP1'
      WHEN is_account_opening_fee_applicable = TRUE THEN 'AOF'
      ELSE 'Regular'
    END AS segment,
    COUNT(*) AS total_onboard
  FROM \`sandbox_risk.ft_application_decision_base\`
  WHERE decision = 'APPROVED'
  GROUP BY 1, 2
)
SELECT DISTINCT
  a.month_onboard,
  a.segment,
  a.total_onboard,
  b.total_accepted_user,
  SUM(total_onboard) OVER (PARTITION BY a.segment ORDER BY month_onboard ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_total_onboard,
  SUM(total_accepted_user) OVER (PARTITION BY a.segment ORDER BY month_onboard ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_total_accepted_user
FROM T2 a
LEFT JOIN acceptance b ON a.month_onboard = b.month_key AND a.segment = b.segment
ORDER BY 1
`;

export function getOnboardingFunnelQuery(): QueryInfo {
  return {
    title: "Orico: Onboarding Funnel",
    sql: ONBOARDING_FUNNEL_SQL,
    params: [],
  };
}

export async function getOnboardingFunnel(): Promise<OnboardingFunnelRow[]> {
  return runQuery<OnboardingFunnelRow>(ONBOARDING_FUNNEL_SQL);
}

// ── Query 8: Booked Customer KPIs (new & cumulative by card type) ────────────

export interface BookedCustomerKpiRow {
  month_key: string;
  new_customers: number;
  new_rp1: number;
  new_core: number;
  cumulative_total: number;
  cumulative_rp1: number;
}

const BOOKED_CUSTOMER_KPIS_SQL = `
WITH booked AS (
  SELECT
    DATE_TRUNC(unblock_date, MONTH) AS month_key,
    b.F9_DW005_LOC_ACCT,
    CASE
      WHEN d.is_prepaid_card_applicable = TRUE THEN 'RP1'
      WHEN d.is_account_opening_fee_applicable = TRUE THEN 'AOF'
      ELSE 'Core'
    END AS card_type
  FROM \`sandbox_finance.dim_booked_customer\` b
  LEFT JOIN \`sandbox_finance.dim_map_application_locacct\` c ON b.F9_DW005_LOC_ACCT = c.loc
  LEFT JOIN \`sandbox_risk.ft_application_decision_base\` d ON c.application_status_id = d.application_status_id
  WHERE b.card_type <> 'Unidentified'
)
SELECT
  month_key,
  COUNT(DISTINCT F9_DW005_LOC_ACCT) AS new_customers,
  COUNT(DISTINCT CASE WHEN card_type = 'RP1' THEN F9_DW005_LOC_ACCT END) AS new_rp1,
  COUNT(DISTINCT CASE WHEN card_type IN ('Core', 'AOF') THEN F9_DW005_LOC_ACCT END) AS new_core,
  SUM(COUNT(DISTINCT F9_DW005_LOC_ACCT)) OVER (ORDER BY month_key) AS cumulative_total,
  SUM(COUNT(DISTINCT CASE WHEN card_type = 'RP1' THEN F9_DW005_LOC_ACCT END)) OVER (ORDER BY month_key) AS cumulative_rp1
FROM booked
GROUP BY 1
ORDER BY 1
`;

export function getBookedCustomerKpisQuery(): QueryInfo {
  return {
    title: "Orico: Booked Customer KPIs",
    sql: BOOKED_CUSTOMER_KPIS_SQL,
    params: [],
  };
}

export async function getBookedCustomerKpis(): Promise<BookedCustomerKpiRow[]> {
  return runQuery<BookedCustomerKpiRow>(BOOKED_CUSTOMER_KPIS_SQL);
}

// ── Query 9: Portfolio Balances (receivables, DPD buckets, NPL) ──────────────

export interface PortfolioBalanceRow {
  month_key: string;
  gross_receivables: number;
  current_0: number;
  dpd_1_30: number;
  dpd_31_60: number;
  dpd_61_90: number;
  dpd_91_120: number;
  dpd_121_150: number;
  dpd_151_180: number;
  npl: number;
  total_accounts: number;
  total_limit: number;
  active_accounts: number;
}

const PORTFOLIO_BALANCES_SQL = `
SELECT
  DATE_TRUNC(reporting_date_day, MONTH) AS month_key,
  SUM(FLOOR(F9_DW004_CLO_BAL)) AS gross_receivables,
  SUM(CASE WHEN dpd_bi = 0 THEN FLOOR(F9_DW004_CLO_BAL) ELSE 0 END) AS current_0,
  SUM(CASE WHEN dpd_bi BETWEEN 1 AND 30 THEN FLOOR(F9_DW004_CLO_BAL) ELSE 0 END) AS dpd_1_30,
  SUM(CASE WHEN dpd_bi BETWEEN 31 AND 60 THEN FLOOR(F9_DW004_CLO_BAL) ELSE 0 END) AS dpd_31_60,
  SUM(CASE WHEN dpd_bi BETWEEN 61 AND 90 THEN FLOOR(F9_DW004_CLO_BAL) ELSE 0 END) AS dpd_61_90,
  SUM(CASE WHEN dpd_bi BETWEEN 91 AND 120 THEN FLOOR(F9_DW004_CLO_BAL) ELSE 0 END) AS dpd_91_120,
  SUM(CASE WHEN dpd_bi BETWEEN 121 AND 150 THEN FLOOR(F9_DW004_CLO_BAL) ELSE 0 END) AS dpd_121_150,
  SUM(CASE WHEN dpd_bi BETWEEN 151 AND 180 THEN FLOOR(F9_DW004_CLO_BAL) ELSE 0 END) AS dpd_151_180,
  SUM(CASE WHEN dpd_bi >= 91 THEN FLOOR(F9_DW004_CLO_BAL) ELSE 0 END) AS npl,
  COUNT(DISTINCT P9_DW004_LOC_ACCT) AS total_accounts,
  SUM(F9_DW004_LOC_LMT) AS total_limit,
  COUNT(DISTINCT CASE WHEN dpd_bi < 7 THEN P9_DW004_LOC_ACCT END) AS active_accounts
FROM \`sandbox_finance.dim_daily_portfolio\`
WHERE reporting_date_day = LAST_DAY(reporting_date_day, MONTH)
  OR reporting_date_day = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY)
GROUP BY 1
ORDER BY 1
`;

export function getPortfolioBalancesQuery(): QueryInfo {
  return {
    title: "Orico: Portfolio Balances",
    sql: PORTFOLIO_BALANCES_SQL,
    params: [],
  };
}

export async function getPortfolioBalances(): Promise<PortfolioBalanceRow[]> {
  return runQuery<PortfolioBalanceRow>(PORTFOLIO_BALANCES_SQL);
}

// ── Query 10: Monthly Spending ───────────────────────────────────────────────

export interface MonthlySpendingRow {
  month_key: string;
  transaction_count: number;
  total_spend_idr: number;
  transactors: number;
}

const MONTHLY_SPENDING_SQL = `
WITH card_acct_map AS (
  SELECT DISTINCT
    f9_dw005_crn AS crn,
    f9_dw005_loc_acct AS loc_acct
  FROM \`mart_finexus.principal_card_updates\`
  WHERE f9_dw005_loc_acct IS NOT NULL AND f9_dw005_crn IS NOT NULL
),
-- All product types included (prepaid + opening fee no longer excluded)
SELECT
  DATE_TRUNC(DATE(f9_dw007_dt, 'Asia/Jakarta'), MONTH) AS month_key,
  COUNT(*) AS transaction_count,
  SUM(f9_dw007_amt_req / 100) AS total_spend_idr,
  COUNT(DISTINCT m.loc_acct) AS transactors
FROM \`mart_finexus.authorized_transaction\` t
JOIN card_acct_map m ON t.f9_dw007_prin_crn = m.crn
WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '')
  AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
  AND f9_dw007_ori_amt > 0
GROUP BY 1
ORDER BY 1
`;

export function getMonthlySpendingQuery(): QueryInfo {
  return {
    title: "Orico: Monthly Spending",
    sql: MONTHLY_SPENDING_SQL,
    params: [],
  };
}

export async function getMonthlySpending(): Promise<MonthlySpendingRow[]> {
  return runQuery<MonthlySpendingRow>(MONTHLY_SPENDING_SQL);
}

// ── Query 11: Flow Rates (DPD bucket migration) ─────────────────────────────

export interface FlowRateRow {
  month_key: string;
  from_bucket: string;
  to_bucket: string;
  account_count: number;
  flow_rate: number;
}

const FLOW_RATES_SQL = `
WITH monthly_dpd AS (
  SELECT
    P9_DW004_LOC_ACCT,
    DATE_TRUNC(reporting_date_day, MONTH) AS month_key,
    CASE
      WHEN dpd_bi = 0 THEN 'Current'
      WHEN dpd_bi BETWEEN 1 AND 30 THEN 'DPD 1-30'
      WHEN dpd_bi BETWEEN 31 AND 60 THEN 'DPD 31-60'
      WHEN dpd_bi BETWEEN 61 AND 90 THEN 'DPD 61-90'
      WHEN dpd_bi BETWEEN 91 AND 120 THEN 'DPD 91-120'
      WHEN dpd_bi BETWEEN 121 AND 150 THEN 'DPD 121-150'
      WHEN dpd_bi BETWEEN 151 AND 180 THEN 'DPD 151-180'
      ELSE 'DPD 180+'
    END AS dpd_bucket
  FROM \`sandbox_finance.dim_daily_portfolio\`
  WHERE reporting_date_day = LAST_DAY(reporting_date_day, MONTH)
    OR reporting_date_day = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY)
),
transitions AS (
  SELECT
    curr.month_key,
    prev.dpd_bucket AS from_bucket,
    curr.dpd_bucket AS to_bucket,
    COUNT(DISTINCT curr.P9_DW004_LOC_ACCT) AS account_count
  FROM monthly_dpd curr
  JOIN monthly_dpd prev
    ON curr.P9_DW004_LOC_ACCT = prev.P9_DW004_LOC_ACCT
    AND curr.month_key = DATE_ADD(prev.month_key, INTERVAL 1 MONTH)
  GROUP BY 1, 2, 3
)
SELECT
  month_key,
  from_bucket,
  to_bucket,
  account_count,
  SAFE_DIVIDE(account_count, SUM(account_count) OVER (PARTITION BY month_key, from_bucket)) AS flow_rate
FROM transitions
ORDER BY 1, 2, 3
`;

export function getFlowRatesQuery(): QueryInfo {
  return {
    title: "Orico: Flow Rates",
    sql: FLOW_RATES_SQL,
    params: [],
  };
}

export async function getFlowRates(): Promise<FlowRateRow[]> {
  return runQuery<FlowRateRow>(FLOW_RATES_SQL);
}

// ── Query 12: Revolving Rate ─────────────────────────────────────────────────

export interface RevolvingRateRow {
  month_key: string;
  active_accounts: number;
  revolving_accounts: number;
  revolving_rate: number;
}

const REVOLVING_RATE_SQL = `
SELECT
  DATE_TRUNC(reporting_date_day, MONTH) AS month_key,
  COUNT(DISTINCT CASE WHEN dpd_bi < 7 THEN P9_DW004_LOC_ACCT END) AS active_accounts,
  COUNT(DISTINCT CASE WHEN dpd_bi < 7 AND F9_DW004_CLO_BAL > F9_DW004_MIN_DUE THEN P9_DW004_LOC_ACCT END) AS revolving_accounts,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN dpd_bi < 7 AND F9_DW004_CLO_BAL > F9_DW004_MIN_DUE THEN P9_DW004_LOC_ACCT END),
    COUNT(DISTINCT CASE WHEN dpd_bi < 7 THEN P9_DW004_LOC_ACCT END)
  ) AS revolving_rate
FROM \`sandbox_finance.dim_daily_portfolio\`
WHERE reporting_date_day = LAST_DAY(reporting_date_day, MONTH)
  OR reporting_date_day = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY)
GROUP BY 1
ORDER BY 1
`;

export function getRevolvingRateQuery(): QueryInfo {
  return {
    title: "Orico: Revolving Rate",
    sql: REVOLVING_RATE_SQL,
    params: [],
  };
}

export async function getRevolvingRate(): Promise<RevolvingRateRow[]> {
  return runQuery<RevolvingRateRow>(REVOLVING_RATE_SQL);
}
