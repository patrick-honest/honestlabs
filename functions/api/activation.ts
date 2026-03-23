import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";
import { productTypeWhere, cardTypeWhere, transactionTypeWhere, amountRangeWhere, cycleDateWhere } from "../_shared/filters";

async function queryActivation(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  const [activationRateTrend, daysToFirstTransaction, activationByProductType, dormancyAnalysis, pinSetRateTrend] = await Promise.all([
    // 1. Activation Rate Trend — weekly approved vs activated (1st txn ≤7d)
    runQuery(
      `WITH approved AS (
        SELECT
          FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(dc.timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week,
          dc.user_id
        FROM ${TABLES.decision_completed} dc
        WHERE dc.decision = 'APPROVED'
          AND DATE(dc.timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
          ${productTypeWhere(filters, 'dc')}
      ),
      first_txn AS (
        SELECT
          a.user_id,
          a.week,
          MIN(DATE(t.f9_dw007_dt)) AS first_txn_date,
          MIN(DATE(a_ts.timestamp, 'Asia/Jakarta')) AS approval_date
        FROM approved a
        INNER JOIN ${TABLES.decision_completed} a_ts
          ON a.user_id = a_ts.user_id
          AND a_ts.decision = 'APPROVED'
        INNER JOIN ${TABLES.cms_line_of_credit} loc
          ON a.user_id = loc.user_id
        INNER JOIN ${TABLES.principal_card_updates} pc
          ON loc.external_id = pc.f9_dw005_loc_acct
          ${cardTypeWhere(filters, 'pc')}
        INNER JOIN ${TABLES.authorized_transaction} t
          ON pc.f9_dw005_crn = t.f9_dw007_prin_crn
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
          ${transactionTypeWhere(filters, 't')}
          ${amountRangeWhere(filters, 't')}
        GROUP BY a.user_id, a.week
        HAVING DATE_DIFF(first_txn_date, approval_date, DAY) <= 7
      )
      SELECT
        a.week,
        COUNT(DISTINCT a.user_id) AS approved_count,
        COUNT(DISTINCT ft.user_id) AS activated_count,
        ROUND(SAFE_DIVIDE(COUNT(DISTINCT ft.user_id), COUNT(DISTINCT a.user_id)) * 100, 2) AS rate
      FROM approved a
      LEFT JOIN first_txn ft ON a.user_id = ft.user_id AND a.week = ft.week
      GROUP BY a.week
      ORDER BY a.week`,
      { startDate, endDate },
      env,
    ),

    // 2. Days to First Transaction — distribution buckets
    runQuery(
      `WITH approved_users AS (
        SELECT
          dc.user_id,
          MIN(DATE(dc.timestamp, 'Asia/Jakarta')) AS approval_date
        FROM ${TABLES.decision_completed} dc
        WHERE dc.decision = 'APPROVED'
          AND DATE(dc.timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
          ${productTypeWhere(filters, 'dc')}
        GROUP BY dc.user_id
      ),
      first_txn AS (
        SELECT
          au.user_id,
          au.approval_date,
          MIN(DATE(t.f9_dw007_dt)) AS first_txn_date
        FROM approved_users au
        INNER JOIN ${TABLES.cms_line_of_credit} loc ON au.user_id = loc.user_id
        INNER JOIN ${TABLES.principal_card_updates} pc ON loc.external_id = pc.f9_dw005_loc_acct
          ${cardTypeWhere(filters, 'pc')}
        INNER JOIN ${TABLES.authorized_transaction} t
          ON pc.f9_dw005_crn = t.f9_dw007_prin_crn
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
          ${transactionTypeWhere(filters, 't')}
          ${amountRangeWhere(filters, 't')}
        GROUP BY au.user_id, au.approval_date
      ),
      bucketed AS (
        SELECT
          CASE
            WHEN DATE_DIFF(first_txn_date, approval_date, DAY) <= 1 THEN '0-1'
            WHEN DATE_DIFF(first_txn_date, approval_date, DAY) <= 3 THEN '2-3'
            WHEN DATE_DIFF(first_txn_date, approval_date, DAY) <= 7 THEN '4-7'
            WHEN DATE_DIFF(first_txn_date, approval_date, DAY) <= 14 THEN '8-14'
            ELSE '14+'
          END AS days_bucket
        FROM first_txn
      )
      SELECT
        days_bucket,
        COUNT(*) AS count
      FROM bucketed
      GROUP BY days_bucket
      ORDER BY
        CASE days_bucket
          WHEN '0-1' THEN 1
          WHEN '2-3' THEN 2
          WHEN '4-7' THEN 3
          WHEN '8-14' THEN 4
          WHEN '14+' THEN 5
        END`,
      { startDate, endDate },
      env,
    ),

    // 3. Activation by Product Type
    runQuery(
      `WITH approved AS (
        SELECT
          user_id,
          MIN(DATE(timestamp, 'Asia/Jakarta')) AS approval_date,
          CASE
            WHEN LOGICAL_OR(is_prepaid_card_applicable = true) THEN 'RP1'
            WHEN LOGICAL_OR(is_account_opening_fee_applicable = true) THEN 'Opening Fee'
            ELSE 'Standard CC'
          END AS product_type
        FROM ${TABLES.decision_completed} dc
        WHERE dc.decision = 'APPROVED'
          AND DATE(dc.timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
          ${productTypeWhere(filters, 'dc')}
        GROUP BY dc.user_id
      ),
      first_txn AS (
        SELECT
          a.user_id,
          MIN(DATE(t.f9_dw007_dt)) AS first_txn_date
        FROM approved a
        INNER JOIN ${TABLES.cms_line_of_credit} loc ON a.user_id = loc.user_id
        INNER JOIN ${TABLES.principal_card_updates} pc ON loc.external_id = pc.f9_dw005_loc_acct
          ${cardTypeWhere(filters, 'pc')}
        INNER JOIN ${TABLES.authorized_transaction} t
          ON pc.f9_dw005_crn = t.f9_dw007_prin_crn
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
          ${transactionTypeWhere(filters, 't')}
          ${amountRangeWhere(filters, 't')}
        GROUP BY a.user_id
        HAVING DATE_DIFF(first_txn_date, MIN(a.approval_date), DAY) <= 7
      )
      SELECT
        a.product_type,
        COUNT(DISTINCT a.user_id) AS approved,
        COUNT(DISTINCT ft.user_id) AS activated,
        ROUND(SAFE_DIVIDE(COUNT(DISTINCT ft.user_id), COUNT(DISTINCT a.user_id)) * 100, 2) AS rate
      FROM approved a
      LEFT JOIN first_txn ft ON a.user_id = ft.user_id
      GROUP BY a.product_type
      ORDER BY approved DESC`,
      { startDate, endDate },
      env,
    ),

    // 4. Dormancy Analysis — account status buckets from DW004
    runQuery(
      `SELECT
        CASE
          WHEN f9_dw004_curr_dpd = 0 AND fx_dw004_loc_stat IN ('G', 'N') THEN 'Active (0 DPD)'
          WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30 DPD'
          ELSE '30+ DPD'
        END AS bucket,
        COUNT(DISTINCT p9_dw004_loc_acct) AS accounts
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt = (
        SELECT MAX(f9_dw004_bus_dt)
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt <= @endDate
      )
      GROUP BY bucket`,
      { endDate },
      env,
    ),

    // 5. PIN Set Rate Trend
    runQuery(
      `WITH decisions AS (
        SELECT
          FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(dc.timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week,
          dc.user_id
        FROM ${TABLES.decision_completed} dc
        WHERE dc.decision = 'APPROVED'
          AND DATE(dc.timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
          ${productTypeWhere(filters, 'dc')}
      ),
      pin_set AS (
        SELECT DISTINCT
          d.user_id,
          d.week
        FROM decisions d
        INNER JOIN ${TABLES.cms_line_of_credit} loc ON d.user_id = loc.user_id
        INNER JOIN ${TABLES.principal_card_updates} pc ON loc.external_id = pc.f9_dw005_loc_acct
        WHERE pc.f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL
          ${cardTypeWhere(filters, 'pc')}
      )
      SELECT
        d.week,
        COUNT(DISTINCT d.user_id) AS decision_count,
        COUNT(DISTINCT ps.user_id) AS pin_set_count,
        ROUND(SAFE_DIVIDE(COUNT(DISTINCT ps.user_id), COUNT(DISTINCT d.user_id)) * 100, 2) AS rate
      FROM decisions d
      LEFT JOIN pin_set ps ON d.user_id = ps.user_id AND d.week = ps.week
      GROUP BY d.week
      ORDER BY d.week`,
      { startDate, endDate },
      env,
    ),
  ]);

  // Additional trend queries for line chart versions
  const [productRateTrend, daysDistributionTrend] = await Promise.all([
    // Activation rate by product type — weekly trend
    runQuery(
      `WITH approved AS (
        SELECT user_id,
          DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK) AS week_start,
          MIN(DATE(timestamp, 'Asia/Jakarta')) AS approval_date,
          CASE
            WHEN LOGICAL_OR(is_prepaid_card_applicable = true) THEN 'RP1'
            WHEN LOGICAL_OR(is_account_opening_fee_applicable = true) THEN 'Opening Fee'
            ELSE 'Standard CC'
          END AS product_type
        FROM ${TABLES.decision_completed}
        WHERE decision = 'APPROVED'
          AND DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        GROUP BY user_id, week_start
      ),
      first_txn AS (
        SELECT a.user_id, MIN(DATE(t.f9_dw007_dt)) AS first_txn_date
        FROM approved a
        JOIN ${TABLES.cms_line_of_credit} loc ON a.user_id = loc.user_id
        JOIN ${TABLES.principal_card_updates} pc ON loc.external_id = pc.f9_dw005_loc_acct
        JOIN ${TABLES.authorized_transaction} t ON pc.f9_dw005_crn = t.f9_dw007_prin_crn
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        GROUP BY a.user_id
        HAVING DATE_DIFF(first_txn_date, MIN(a.approval_date), DAY) <= 7
      )
      SELECT FORMAT_DATE('%Y-%m-%d', a.week_start + 7) AS week_start,
        a.product_type,
        COUNT(DISTINCT a.user_id) AS approved,
        COUNT(DISTINCT ft.user_id) AS activated,
        ROUND(SAFE_DIVIDE(COUNT(DISTINCT ft.user_id), COUNT(DISTINCT a.user_id)) * 100, 2) AS rate
      FROM approved a
      LEFT JOIN first_txn ft ON a.user_id = ft.user_id
      GROUP BY a.week_start, a.product_type
      ORDER BY a.week_start, a.product_type`,
      { startDate, endDate }, env,
    ),

    // Days-to-activation distribution — weekly trend (% in each bucket per week)
    runQuery(
      `WITH approved AS (
        SELECT user_id,
          DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK) AS week_start,
          MIN(DATE(timestamp, 'Asia/Jakarta')) AS approval_date
        FROM ${TABLES.decision_completed}
        WHERE decision = 'APPROVED'
          AND DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        GROUP BY user_id, week_start
      ),
      first_txn AS (
        SELECT a.user_id,
          DATE_DIFF(MIN(DATE(t.f9_dw007_dt)), a.approval_date, DAY) AS days_to_activate
        FROM approved a
        JOIN ${TABLES.cms_line_of_credit} loc ON a.user_id = loc.user_id
        JOIN ${TABLES.principal_card_updates} pc ON loc.external_id = pc.f9_dw005_loc_acct
        JOIN ${TABLES.authorized_transaction} t ON pc.f9_dw005_crn = t.f9_dw007_prin_crn
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        GROUP BY a.user_id, a.approval_date
      ),
      bucketed AS (
        SELECT a.week_start, a.user_id,
          CASE
            WHEN ft.days_to_activate IS NULL THEN 'Not Activated'
            WHEN ft.days_to_activate <= 1 THEN '0-1 days'
            WHEN ft.days_to_activate <= 3 THEN '2-3 days'
            WHEN ft.days_to_activate <= 7 THEN '4-7 days'
            ELSE '8+ days'
          END AS bucket
        FROM approved a
        LEFT JOIN first_txn ft ON a.user_id = ft.user_id
      )
      SELECT FORMAT_DATE('%Y-%m-%d', week_start + 7) AS week_start,
        ROUND(SAFE_DIVIDE(COUNTIF(bucket = '0-1 days'), COUNT(*)) * 100, 2) AS pct_0_1,
        ROUND(SAFE_DIVIDE(COUNTIF(bucket = '2-3 days'), COUNT(*)) * 100, 2) AS pct_2_3,
        ROUND(SAFE_DIVIDE(COUNTIF(bucket = '4-7 days'), COUNT(*)) * 100, 2) AS pct_4_7,
        ROUND(SAFE_DIVIDE(COUNTIF(bucket IN ('0-1 days','2-3 days','4-7 days')), COUNT(*)) * 100, 2) AS pct_within_7d
      FROM bucketed
      GROUP BY week_start
      ORDER BY week_start`,
      { startDate, endDate }, env,
    ),
  ]);

  return {
    activationRateTrend,
    daysToFirstTransaction,
    activationByProductType,
    dormancyAnalysis,
    pinSetRateTrend,
    productRateTrend,
    daysDistributionTrend,
  };
}

export const onRequest = createHandler({ section: "activation", queryFn: queryActivation });
