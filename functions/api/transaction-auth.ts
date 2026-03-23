import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";
import { transactionTypeWhere, amountRangeWhere } from "../_shared/filters";

async function queryTransactionAuth(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  const [weeklyAuthTrend, topMerchants] = await Promise.all([
    // Weekly Auth Trend — full auth metrics per week (DW007)
    // Page expects: week_start, total_auths, approved, declined, approval_rate,
    //   online_txns, qris_txns, offline_txns, avg_ticket_idr, foreign_txn_pct
    runQuery(
      `SELECT
        FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(t.f9_dw007_dt, ISOWEEK)) AS week_start,
        COUNT(*) AS total_auths,
        COUNTIF(COALESCE(t.fx_dw007_stat, '', ' ') IN ('', ' ')) AS approved,
        COUNTIF(t.fx_dw007_stat = 'D') AS declined,
        ROUND(SAFE_DIVIDE(COUNTIF(COALESCE(t.fx_dw007_stat, '', ' ') IN ('', ' ')), COUNT(*)) * 100, 2) AS approval_rate,
        COUNTIF(t.fx_dw007_txn_typ = 'TM') AS online_txns,
        COUNTIF(t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L') AS qris_txns,
        COUNTIF(t.fx_dw007_txn_typ NOT IN ('TM', 'PM', 'RF', 'BE') AND NOT (t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L')) AS offline_txns,
        ROUND(SAFE_DIVIDE(SUM(CASE WHEN COALESCE(t.fx_dw007_stat, '', ' ') IN ('', ' ') THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 END), COUNTIF(COALESCE(t.fx_dw007_stat, '', ' ') IN ('', ' '))), 2) AS avg_ticket_idr,
        ROUND(SAFE_DIVIDE(COUNTIF(t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest != 'L'), COUNT(*)) * 100, 2) AS foreign_txn_pct
      FROM ${TABLES.authorized_transaction} t
      WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
        AND t.fx_dw007_txn_typ NOT IN ('PM', 'RF', 'BE')
        ${transactionTypeWhere(filters, 't')}
        ${amountRangeWhere(filters, 't')}
      GROUP BY week_start
      ORDER BY week_start`,
      { startDate, endDate },
      env,
    ),

    // Top 15 Merchants by approved txn count (DW007)
    // Page expects: merchant_name, txn_count, total_spend_idr, unique_cards
    runQuery(
      `SELECT
        t.fx_dw007_merc_name AS merchant_name,
        COUNT(*) AS txn_count,
        ROUND(SUM(CAST(t.f9_dw007_amt_req AS FLOAT64) / 100), 2) AS total_spend_idr,
        COUNT(DISTINCT t.f9_dw007_prin_crn) AS unique_cards
      FROM ${TABLES.authorized_transaction} t
      WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
        AND COALESCE(t.fx_dw007_stat, '', ' ') IN ('', ' ')
        AND t.fx_dw007_txn_typ NOT IN ('PM', 'RF', 'BE')
        ${transactionTypeWhere(filters, 't')}
        ${amountRangeWhere(filters, 't')}
      GROUP BY merchant_name
      ORDER BY txn_count DESC
      LIMIT 15`,
      { startDate, endDate },
      env,
    ),
  ]);

  return { weeklyAuthTrend, topMerchants };
}

export const onRequest = createHandler({ section: "transaction-auth", queryFn: queryTransactionAuth });
