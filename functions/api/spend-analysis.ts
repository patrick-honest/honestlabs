import { runQuery, TABLES, toSqlDate } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";
import { cardTypeWhere, transactionTypeWhere, amountRangeWhere, cycleDateWhere } from "../_shared/filters";

const DECLINE_CODE_DESCRIPTIONS: Record<string, string> = {
  D: "Declined by Issuer",
  C: "Captured / Reversed",
  T: "Timeout",
  X: "Expired / Invalid",
  I: "Invalid Card",
  N: "Insufficient Funds",
};

async function querySpendAnalysis(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  const [weeklyTrend, channelBreakdown, declineRows, periodSummaryRows] = await Promise.all([
    // Weekly spend trend — cohort-based SAR + spend metrics
    runQuery(
      `WITH regular_users AS (
        SELECT DISTINCT dc.user_id, loc.external_id AS loc_acct
        FROM ${TABLES.decision_completed} dc
        INNER JOIN ${TABLES.cms_line_of_credit} loc ON dc.user_id = loc.user_id
        WHERE UPPER(dc.decision) = 'APPROVED'
          AND (dc.is_prepaid_card_applicable IS NULL OR dc.is_prepaid_card_applicable = FALSE)
          AND (dc.is_account_opening_fee_applicable IS NULL OR dc.is_account_opening_fee_applicable = FALSE)
      ),
      eligible_check AS (
        SELECT dw4.f9_dw004_bus_dt AS eligible_date, dw4.p9_dw004_prin_crn AS crn, ru.user_id, ru.loc_acct
        FROM ${TABLES.financial_account_updates} dw4
        INNER JOIN regular_users ru ON dw4.p9_dw004_loc_acct = ru.loc_acct
        INNER JOIN ${TABLES.principal_card_updates} dw5
          ON dw4.p9_dw004_loc_acct = dw5.f9_dw005_loc_acct
          AND CAST(DATETIME(dw5.f9_dw005_upd_tms, 'Asia/Jakarta') AS DATE) <= dw4.f9_dw004_bus_dt
        WHERE dw4.fx_dw004_loc_stat IN ('G', 'N') AND dw4.f9_dw004_curr_dpd >= 0
          AND TRIM(CAST(dw5.f9_dw005_1st_unblk_all_mtd_tms AS STRING)) != ''
          AND (dw5.fx_dw005_crd_stat IS NULL OR TRIM(CAST(dw5.fx_dw005_crd_stat AS STRING)) != '')
          AND dw5.f9_dw005_hce_txn_ind LIKE '%0%' AND dw5.f9_dw005_net_txn_ind LIKE '%0%'
          AND dw5.fx_dw005_contc_less_flg LIKE '%Y%' AND dw5.f9_dw005_contc_txn_ind LIKE '%0%'
          ${cardTypeWhere(filters, 'dw5')} ${cycleDateWhere(filters, 'dw4')}
        QUALIFY ROW_NUMBER() OVER (PARTITION BY dw4.p9_dw004_loc_acct, dw4.f9_dw004_bus_dt ORDER BY dw5.f9_dw005_upd_tms DESC) = 1
      ),
      first_eligible AS (
        SELECT user_id, crn, loc_acct, MIN(eligible_date) AS first_eligible_date
        FROM eligible_check GROUP BY user_id, crn, loc_acct
        QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY MIN(eligible_date)) = 1
      ),
      weekly_cohort AS (
        SELECT DATE_TRUNC(first_eligible_date, ISOWEEK) AS week_start, user_id, first_eligible_date, crn, loc_acct
        FROM first_eligible
        WHERE first_eligible_date BETWEEN @startDate AND @endDate
          AND DATE_ADD(DATE_TRUNC(first_eligible_date, ISOWEEK), INTERVAL 13 DAY) <= CURRENT_DATE('Asia/Jakarta')
      ),
      sar_transactors AS (
        SELECT DISTINCT wc.user_id, wc.week_start
        FROM weekly_cohort wc
        INNER JOIN ${TABLES.authorized_transaction} t ON wc.crn = t.f9_dw007_prin_crn
          AND t.f9_dw007_dt BETWEEN wc.first_eligible_date AND DATE_ADD(wc.first_eligible_date, INTERVAL 7 DAY)
        WHERE (t.fx_dw007_stat IS NULL OR t.fx_dw007_stat = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      ),
      card_acct_map AS (SELECT DISTINCT f9_dw005_crn AS crn, f9_dw005_loc_acct AS loc_acct FROM ${TABLES.principal_card_updates}),
      weekly_spend AS (
        SELECT DATE_TRUNC(t.f9_dw007_dt, ISOWEEK) AS week_start,
          COUNT(DISTINCT cam.loc_acct) AS transactor_count_spend, COUNT(*) AS total_transactions,
          ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64)/100),2) AS total_spend_idr,
          ROUND(SUM(CASE WHEN t.fx_dw007_txn_typ='TM' THEN CAST(t.f9_dw007_amt_req AS FLOAT64)/100 ELSE 0 END),2) AS online_spend_idr,
          ROUND(SUM(CASE WHEN t.fx_dw007_txn_typ!='TM' AND NOT(t.fx_dw007_txn_typ='RA' AND t.fx_dw007_rte_dest='L') THEN CAST(t.f9_dw007_amt_req AS FLOAT64)/100 ELSE 0 END),2) AS offline_spend_idr,
          ROUND(SUM(CASE WHEN t.fx_dw007_txn_typ='RA' AND t.fx_dw007_rte_dest='L' THEN CAST(t.f9_dw007_amt_req AS FLOAT64)/100 ELSE 0 END),2) AS qris_spend_idr
        FROM ${TABLES.authorized_transaction} t JOIN card_acct_map cam ON t.f9_dw007_prin_crn = cam.crn
        WHERE (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat)='') AND t.fx_dw007_txn_typ NOT IN ('PM','BE','RF') AND t.f9_dw007_dt BETWEEN @startDate AND @endDate
          ${transactionTypeWhere(filters, 't')} ${amountRangeWhere(filters, 't')}
        GROUP BY week_start
      ),
      sar_weekly AS (
        SELECT wc.week_start + 7 AS week_start,
          COUNT(DISTINCT wc.user_id) AS newly_eligible,
          COUNT(DISTINCT st.user_id) AS activated_users,
          ROUND(COUNT(DISTINCT st.user_id) * 100.0 / COUNT(DISTINCT wc.user_id), 2) AS spend_active_rate
        FROM weekly_cohort wc LEFT JOIN sar_transactors st ON wc.user_id = st.user_id AND wc.week_start = st.week_start
        GROUP BY wc.week_start
      )
      SELECT FORMAT_DATE('%Y-%m-%d', s.week_start) AS week_start,
        COALESCE(sar.newly_eligible, 0) AS eligible_count,
        COALESCE(sar.activated_users, 0) AS transactor_count,
        COALESCE(s.total_transactions, 0) AS total_transactions,
        ROUND(COALESCE(s.total_spend_idr,0),2) AS total_spend_idr,
        COALESCE(sar.spend_active_rate, 0) AS spend_active_rate,
        ROUND(COALESCE(s.online_spend_idr,0),2) AS online_spend_idr,
        ROUND(COALESCE(s.offline_spend_idr,0),2) AS offline_spend_idr,
        ROUND(COALESCE(s.qris_spend_idr,0),2) AS qris_spend_idr,
        ROUND(SAFE_DIVIDE(COALESCE(s.total_spend_idr,0), NULLIF(COALESCE(s.total_transactions,0),0)),2) AS avg_spend_per_txn_idr
      FROM weekly_spend s
      LEFT JOIN sar_weekly sar ON s.week_start = sar.week_start
      ORDER BY s.week_start`,
      { startDate, endDate }, env,
    ),
    // Channel breakdown
    runQuery(
      `SELECT CASE WHEN t.fx_dw007_txn_typ='RA' AND t.fx_dw007_rte_dest='L' THEN 'QRIS' WHEN t.fx_dw007_txn_typ='TM' THEN 'Online' ELSE 'Offline' END AS channel,
        COUNT(*) AS txn_count, ROUND(SUM(t.f9_dw007_amt_req/100),0) AS spend_idr, COUNT(DISTINCT t.f9_dw007_prin_crn) AS unique_cards
      FROM ${TABLES.authorized_transaction} t
      WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat)='' OR t.fx_dw007_stat=' ') AND t.fx_dw007_txn_typ NOT IN ('PM','BE','RF')
        ${transactionTypeWhere(filters, 't')}
        ${amountRangeWhere(filters, 't')}
      GROUP BY channel`,
      { startDate, endDate }, env,
    ),
    // Decline breakdown
    runQuery<{ code: string; cnt: number; amount_idr: number }>(
      `SELECT t.fx_dw007_stat AS code, COUNT(*) AS cnt, ROUND(SUM(t.f9_dw007_amt_req/100),0) AS amount_idr
      FROM ${TABLES.authorized_transaction} t
      WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate AND t.fx_dw007_stat IS NOT NULL AND TRIM(t.fx_dw007_stat)!='' AND t.fx_dw007_stat!=' '
        ${transactionTypeWhere(filters, 't')}
        ${amountRangeWhere(filters, 't')}
      GROUP BY code ORDER BY cnt DESC`,
      { startDate, endDate }, env,
    ),
    // Period summary — cohort-based SAR for the full period
    runQuery(
      `WITH regular_users AS (
        SELECT DISTINCT dc.user_id, loc.external_id AS loc_acct
        FROM ${TABLES.decision_completed} dc
        INNER JOIN ${TABLES.cms_line_of_credit} loc ON dc.user_id = loc.user_id
        WHERE UPPER(dc.decision) = 'APPROVED'
          AND (dc.is_prepaid_card_applicable IS NULL OR dc.is_prepaid_card_applicable = FALSE)
          AND (dc.is_account_opening_fee_applicable IS NULL OR dc.is_account_opening_fee_applicable = FALSE)
      ),
      eligible_check AS (
        SELECT dw4.f9_dw004_bus_dt AS eligible_date, dw4.p9_dw004_prin_crn AS crn, ru.user_id
        FROM ${TABLES.financial_account_updates} dw4
        INNER JOIN regular_users ru ON dw4.p9_dw004_loc_acct = ru.loc_acct
        INNER JOIN ${TABLES.principal_card_updates} dw5
          ON dw4.p9_dw004_loc_acct = dw5.f9_dw005_loc_acct
          AND CAST(DATETIME(dw5.f9_dw005_upd_tms, 'Asia/Jakarta') AS DATE) <= dw4.f9_dw004_bus_dt
        WHERE dw4.fx_dw004_loc_stat IN ('G','N') AND dw4.f9_dw004_curr_dpd >= 0
          AND TRIM(CAST(dw5.f9_dw005_1st_unblk_all_mtd_tms AS STRING)) != ''
          AND (dw5.fx_dw005_crd_stat IS NULL OR TRIM(CAST(dw5.fx_dw005_crd_stat AS STRING)) != '')
          AND dw5.f9_dw005_hce_txn_ind LIKE '%0%' AND dw5.f9_dw005_net_txn_ind LIKE '%0%'
          AND dw5.fx_dw005_contc_less_flg LIKE '%Y%' AND dw5.f9_dw005_contc_txn_ind LIKE '%0%'
          ${cardTypeWhere(filters, 'dw5')} ${cycleDateWhere(filters, 'dw4')}
        QUALIFY ROW_NUMBER() OVER (PARTITION BY dw4.p9_dw004_loc_acct, dw4.f9_dw004_bus_dt ORDER BY dw5.f9_dw005_upd_tms DESC) = 1
      ),
      first_eligible AS (
        SELECT user_id, crn, MIN(eligible_date) AS first_eligible_date
        FROM eligible_check GROUP BY user_id, crn
        QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY MIN(eligible_date)) = 1
      ),
      period_cohort AS (
        SELECT user_id, first_eligible_date, crn
        FROM first_eligible
        WHERE first_eligible_date BETWEEN @startDate AND @endDate
          AND DATE_ADD(first_eligible_date, INTERVAL 7 DAY) <= CURRENT_DATE('Asia/Jakarta')
      ),
      transactors AS (
        SELECT DISTINCT pc.user_id
        FROM period_cohort pc
        INNER JOIN ${TABLES.authorized_transaction} t ON pc.crn = t.f9_dw007_prin_crn
          AND t.f9_dw007_dt BETWEEN pc.first_eligible_date AND DATE_ADD(pc.first_eligible_date, INTERVAL 7 DAY)
        WHERE (t.fx_dw007_stat IS NULL OR t.fx_dw007_stat = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM','BE','RF')
          ${transactionTypeWhere(filters, 't')} ${amountRangeWhere(filters, 't')}
      ),
      card_acct_map AS (SELECT DISTINCT f9_dw005_crn AS crn, f9_dw005_loc_acct AS loc_acct FROM ${TABLES.principal_card_updates}),
      spend AS (
        SELECT COUNT(DISTINCT cam.loc_acct) AS transactor_cnt, COUNT(*) AS total_txns, ROUND(SUM(CAST(dw7.f9_dw007_amt_req AS FLOAT64)/100),2) AS total_spend
        FROM ${TABLES.authorized_transaction} dw7 JOIN card_acct_map cam ON dw7.f9_dw007_prin_crn=cam.crn
        WHERE (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat)='') AND dw7.fx_dw007_txn_typ NOT IN ('PM','BE','RF') AND dw7.f9_dw007_dt BETWEEN @startDate AND @endDate
          ${transactionTypeWhere(filters, 'dw7')} ${amountRangeWhere(filters, 'dw7')}
      )
      SELECT
        (SELECT COUNT(*) FROM period_cohort) AS eligible_count,
        (SELECT COUNT(*) FROM transactors) AS transactor_count,
        s.total_txns AS total_transactions,
        s.total_spend AS total_spend_idr,
        ROUND((SELECT COUNT(*) FROM transactors) * 100.0 / NULLIF((SELECT COUNT(*) FROM period_cohort), 0), 2) AS spend_active_rate,
        ROUND(SAFE_DIVIDE(s.total_spend, NULLIF(s.total_txns,0)),2) AS avg_spend_per_txn_idr
      FROM spend s`,
      { startDate, endDate }, env,
    ),
  ]);

  return {
    weeklySpendTrend: weeklyTrend,
    channelBreakdown: channelBreakdown,
    declineBreakdown: declineRows.map((r: Record<string, unknown>) => ({
      ...r,
      description: DECLINE_CODE_DESCRIPTIONS[r.code as string] ?? `Unknown: ${r.code}`,
    })),
    periodSummary: (periodSummaryRows as unknown[])[0] ?? null,
  };
}

export const onRequest = createHandler({ section: "spend-analysis", queryFn: querySpendAnalysis });
