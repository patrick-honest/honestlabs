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
    // Weekly spend trend
    runQuery(
      `WITH
      card_unblocked AS (
        SELECT DISTINCT pc.f9_dw005_loc_acct AS loc_acct FROM ${TABLES.principal_card_updates} pc
        WHERE pc.f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL AND TRIM(CAST(pc.f9_dw005_1st_unblk_all_mtd_tms AS STRING)) != ''
          AND pc.f9_dw005_hce_txn_ind LIKE '%0%' AND pc.f9_dw005_net_txn_ind LIKE '%0%' AND pc.fx_dw005_contc_less_flg LIKE '%Y%' AND pc.f9_dw005_contc_txn_ind LIKE '%0%'
          ${cardTypeWhere(filters, 'pc')}
      ),
      weekly_eligible AS (
        SELECT DATE_TRUNC(a.f9_dw004_bus_dt, WEEK(MONDAY)) AS week_start, COUNT(DISTINCT a.p9_dw004_loc_acct) AS eligible_count
        FROM ${TABLES.financial_account_updates} a JOIN card_unblocked c ON a.p9_dw004_loc_acct = c.loc_acct
        WHERE EXTRACT(DAYOFWEEK FROM a.f9_dw004_bus_dt) = 1 AND a.fx_dw004_loc_stat IN ('G', 'N') AND a.f9_dw004_bus_dt BETWEEN @startDate AND @endDate AND a.f9_dw004_curr_dpd >= 0
          ${cycleDateWhere(filters, 'a')}
        GROUP BY week_start
      ),
      card_acct_map AS (SELECT DISTINCT f9_dw005_crn AS crn, f9_dw005_loc_acct AS loc_acct FROM ${TABLES.principal_card_updates}),
      weekly_transactors AS (
        SELECT DATE_TRUNC(t.f9_dw007_dt, WEEK(MONDAY)) AS week_start, COUNT(DISTINCT cam.loc_acct) AS transactor_count, COUNT(*) AS total_transactions,
          ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64)/100),2) AS total_spend_idr,
          ROUND(SUM(CASE WHEN t.fx_dw007_txn_typ='TM' THEN CAST(t.f9_dw007_amt_req AS FLOAT64)/100 ELSE 0 END),2) AS online_spend_idr,
          ROUND(SUM(CASE WHEN t.fx_dw007_txn_typ!='TM' AND NOT(t.fx_dw007_txn_typ='RA' AND t.fx_dw007_rte_dest='L') THEN CAST(t.f9_dw007_amt_req AS FLOAT64)/100 ELSE 0 END),2) AS offline_spend_idr,
          ROUND(SUM(CASE WHEN t.fx_dw007_txn_typ='RA' AND t.fx_dw007_rte_dest='L' THEN CAST(t.f9_dw007_amt_req AS FLOAT64)/100 ELSE 0 END),2) AS qris_spend_idr
        FROM ${TABLES.authorized_transaction} t JOIN card_acct_map cam ON t.f9_dw007_prin_crn = cam.crn
        WHERE (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat)='') AND t.fx_dw007_txn_typ NOT IN ('PM','BE','RF') AND t.f9_dw007_dt BETWEEN @startDate AND @endDate
          ${transactionTypeWhere(filters, 't')}
          ${amountRangeWhere(filters, 't')}
        GROUP BY week_start
      )
      SELECT FORMAT_DATE('%Y-%m-%d', e.week_start) AS week_start, e.eligible_count,
        COALESCE(t.transactor_count,0) AS transactor_count, COALESCE(t.total_transactions,0) AS total_transactions,
        ROUND(COALESCE(t.total_spend_idr,0),2) AS total_spend_idr,
        ROUND(SAFE_DIVIDE(COALESCE(t.transactor_count,0), e.eligible_count)*100,2) AS spend_active_rate,
        ROUND(COALESCE(t.online_spend_idr,0),2) AS online_spend_idr, ROUND(COALESCE(t.offline_spend_idr,0),2) AS offline_spend_idr,
        ROUND(COALESCE(t.qris_spend_idr,0),2) AS qris_spend_idr,
        ROUND(SAFE_DIVIDE(COALESCE(t.total_spend_idr,0), NULLIF(COALESCE(t.total_transactions,0),0)),2) AS avg_spend_per_txn_idr
      FROM weekly_eligible e LEFT JOIN weekly_transactors t USING(week_start) ORDER BY e.week_start`,
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
    // Period summary
    runQuery(
      `WITH card_unblocked AS (
        SELECT DISTINCT pc.f9_dw005_loc_acct AS loc_acct FROM ${TABLES.principal_card_updates} pc
        WHERE pc.f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL AND TRIM(CAST(pc.f9_dw005_1st_unblk_all_mtd_tms AS STRING))!=''
          AND pc.f9_dw005_hce_txn_ind LIKE '%0%' AND pc.f9_dw005_net_txn_ind LIKE '%0%' AND pc.fx_dw005_contc_less_flg LIKE '%Y%' AND pc.f9_dw005_contc_txn_ind LIKE '%0%'
          ${cardTypeWhere(filters, 'pc')}
      ),
      eligible AS (
        SELECT COUNT(DISTINCT a.p9_dw004_loc_acct) AS cnt FROM ${TABLES.financial_account_updates} a
        JOIN card_unblocked c ON a.p9_dw004_loc_acct=c.loc_acct
        WHERE a.f9_dw004_bus_dt=(SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates} WHERE f9_dw004_bus_dt<=@endDate)
          AND a.fx_dw004_loc_stat IN ('G','N') AND a.f9_dw004_curr_dpd>=0
          ${cycleDateWhere(filters, 'a')}
      ),
      card_acct_map AS (SELECT DISTINCT f9_dw005_crn AS crn, f9_dw005_loc_acct AS loc_acct FROM ${TABLES.principal_card_updates}),
      transactors AS (
        SELECT COUNT(DISTINCT cam.loc_acct) AS cnt, COUNT(*) AS total_txns, ROUND(SUM(CAST(dw7.f9_dw007_amt_req AS FLOAT64)/100),2) AS total_spend
        FROM ${TABLES.authorized_transaction} dw7 JOIN card_acct_map cam ON dw7.f9_dw007_prin_crn=cam.crn
        WHERE (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat)='') AND dw7.fx_dw007_txn_typ NOT IN ('PM','BE','RF') AND dw7.f9_dw007_dt BETWEEN @startDate AND @endDate
          ${transactionTypeWhere(filters, 'dw7')}
          ${amountRangeWhere(filters, 'dw7')}
      )
      SELECT e.cnt AS eligible_count, t.cnt AS transactor_count, t.total_txns AS total_transactions, t.total_spend AS total_spend_idr,
        ROUND(SAFE_DIVIDE(t.cnt, e.cnt)*100,2) AS spend_active_rate,
        ROUND(SAFE_DIVIDE(t.total_spend, NULLIF(t.total_txns,0)),2) AS avg_spend_per_txn_idr
      FROM eligible e, transactors t`,
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
