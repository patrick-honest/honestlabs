import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";

async function queryBillingCycle(startDate: string, endDate: string, env: Env) {
  const [overview, revolveTrend, utilizationDistribution, dpdDistribution, balanceTrend, paymentBehavior] = await Promise.all([
    // 1. Cycle Overview — snapshot for endDate (latest business date)
    // Page expects: cycle_day, total_accounts, with_balance, revolving, revolve_rate,
    //   avg_utilization, avg_balance_idr, avg_limit_idr, avg_dpd
    runQuery(
      `SELECT
        EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
        COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts,
        COUNTIF(f9_dw004_clo_bal > 0) AS with_balance,
        COUNTIF(f9_dw004_clo_bal > 0 AND f9_dw004_curr_min_rpmt > 0) AS revolving,
        ROUND(SAFE_DIVIDE(
          COUNTIF(f9_dw004_clo_bal > 0 AND f9_dw004_curr_min_rpmt > 0),
          COUNTIF(f9_dw004_clo_bal > 0)
        ) * 100, 2) AS revolve_rate,
        ROUND(AVG(CASE
          WHEN f9_dw004_loc_lmt > 0 AND f9_dw004_clo_bal > 0
          THEN LEAST(f9_dw004_clo_bal * 100.0 / f9_dw004_loc_lmt, 200)
        END), 2) AS avg_utilization,
        ROUND(AVG(CASE WHEN f9_dw004_clo_bal > 0 THEN f9_dw004_clo_bal / 100.0 END), 0) AS avg_balance_idr,
        ROUND(AVG(CASE WHEN f9_dw004_loc_lmt > 0 THEN f9_dw004_loc_lmt / 100.0 END), 0) AS avg_limit_idr,
        ROUND(AVG(CASE WHEN f9_dw004_curr_dpd > 0 THEN f9_dw004_curr_dpd END), 1) AS avg_dpd
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt = (
        SELECT MAX(f9_dw004_bus_dt)
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt <= @endDate
      )
        AND fx_dw004_loc_stat IN ('G', 'N')
        AND f9_dw004_stmt_due_dt IS NOT NULL
      GROUP BY 1
      ORDER BY 1`,
      { endDate },
      env,
    ),

    // 2. Revolve Rate Trend — monthly, by cycle day
    // Page expects: month, cycle_day, revolve_rate, total_active, revolving
    runQuery(
      `WITH monthly AS (
        SELECT
          FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
          EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
          p9_dw004_loc_acct,
          ROW_NUMBER() OVER (
            PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)
            ORDER BY f9_dw004_bus_dt DESC
          ) AS rn,
          f9_dw004_clo_bal,
          f9_dw004_curr_min_rpmt
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
          AND fx_dw004_loc_stat IN ('G', 'N')
          AND f9_dw004_stmt_due_dt IS NOT NULL
      )
      SELECT
        month,
        cycle_day,
        ROUND(SAFE_DIVIDE(
          COUNTIF(f9_dw004_clo_bal > 0 AND f9_dw004_curr_min_rpmt > 0),
          COUNTIF(f9_dw004_clo_bal > 0)
        ) * 100, 2) AS revolve_rate,
        COUNT(*) AS total_active,
        COUNTIF(f9_dw004_clo_bal > 0 AND f9_dw004_curr_min_rpmt > 0) AS revolving
      FROM monthly
      WHERE rn = 1
      GROUP BY 1, 2
      ORDER BY 1, 2`,
      { startDate, endDate },
      env,
    ),

    // 3. Utilization Distribution — buckets by cycle day
    // Page expects: cycle_day, bucket, accounts, pct
    runQuery(
      `WITH util AS (
        SELECT
          EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
          CASE
            WHEN f9_dw004_loc_lmt <= 0 OR f9_dw004_clo_bal <= 0 THEN 'No Balance'
            WHEN f9_dw004_clo_bal * 100.0 / f9_dw004_loc_lmt <= 25 THEN '0-25%'
            WHEN f9_dw004_clo_bal * 100.0 / f9_dw004_loc_lmt <= 50 THEN '25-50%'
            WHEN f9_dw004_clo_bal * 100.0 / f9_dw004_loc_lmt <= 75 THEN '50-75%'
            WHEN f9_dw004_clo_bal * 100.0 / f9_dw004_loc_lmt <= 100 THEN '75-100%'
            ELSE '>100%'
          END AS bucket
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt = (
          SELECT MAX(f9_dw004_bus_dt)
          FROM ${TABLES.financial_account_updates}
          WHERE f9_dw004_bus_dt <= @endDate
        )
          AND fx_dw004_loc_stat IN ('G', 'N')
          AND f9_dw004_stmt_due_dt IS NOT NULL
      )
      SELECT
        cycle_day,
        bucket,
        COUNT(*) AS accounts,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY cycle_day), 2) AS pct
      FROM util
      GROUP BY 1, 2
      ORDER BY 1, CASE bucket
        WHEN 'No Balance' THEN 0 WHEN '0-25%' THEN 1 WHEN '25-50%' THEN 2
        WHEN '50-75%' THEN 3 WHEN '75-100%' THEN 4 WHEN '>100%' THEN 5
      END`,
      { endDate },
      env,
    ),

    // 4. DPD Distribution — buckets by cycle day
    // Page expects: cycle_day, bucket, accounts, pct
    runQuery(
      `WITH dpd AS (
        SELECT
          EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
          CASE
            WHEN f9_dw004_curr_dpd = 0 THEN 'Current'
            WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30 DPD'
            WHEN f9_dw004_curr_dpd BETWEEN 31 AND 60 THEN '31-60 DPD'
            WHEN f9_dw004_curr_dpd BETWEEN 61 AND 90 THEN '61-90 DPD'
            ELSE '90+ DPD'
          END AS bucket
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt = (
          SELECT MAX(f9_dw004_bus_dt)
          FROM ${TABLES.financial_account_updates}
          WHERE f9_dw004_bus_dt <= @endDate
        )
          AND fx_dw004_loc_stat IN ('G', 'N')
          AND f9_dw004_stmt_due_dt IS NOT NULL
      )
      SELECT
        cycle_day,
        bucket,
        COUNT(*) AS accounts,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY cycle_day), 2) AS pct
      FROM dpd
      GROUP BY 1, 2
      ORDER BY 1, CASE bucket
        WHEN 'Current' THEN 0 WHEN '1-30 DPD' THEN 1 WHEN '31-60 DPD' THEN 2
        WHEN '61-90 DPD' THEN 3 WHEN '90+ DPD' THEN 4
      END`,
      { endDate },
      env,
    ),

    // 5. Balance Trend — monthly average balance by cycle day
    // Page expects: month, cycle_day, avg_balance_idr, avg_limit_idr, total_balance_idr
    runQuery(
      `WITH monthly AS (
        SELECT
          FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
          EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
          p9_dw004_loc_acct,
          f9_dw004_clo_bal,
          f9_dw004_loc_lmt,
          ROW_NUMBER() OVER (
            PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)
            ORDER BY f9_dw004_bus_dt DESC
          ) AS rn
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
          AND fx_dw004_loc_stat IN ('G', 'N')
          AND f9_dw004_stmt_due_dt IS NOT NULL
          AND f9_dw004_clo_bal > 0
      )
      SELECT
        month,
        cycle_day,
        ROUND(AVG(f9_dw004_clo_bal / 100.0), 0) AS avg_balance_idr,
        ROUND(AVG(f9_dw004_loc_lmt / 100.0), 0) AS avg_limit_idr,
        ROUND(SUM(f9_dw004_clo_bal / 100.0), 0) AS total_balance_idr
      FROM monthly
      WHERE rn = 1
      GROUP BY 1, 2
      ORDER BY 1, 2`,
      { startDate, endDate },
      env,
    ),

    // 6. Payment Behavior — paid in full vs min vs partial vs no payment
    // Page expects: cycle_day, behavior, accounts, pct
    runQuery(
      `WITH pay_behavior AS (
        SELECT
          EXTRACT(DAY FROM f9_dw004_stmt_due_dt) AS cycle_day,
          CASE
            WHEN f9_dw004_clo_bal <= 0 THEN 'Paid in Full'
            WHEN f9_dw004_curr_min_rpmt <= 0 AND f9_dw004_clo_bal > 0 THEN 'Below Min Due'
            WHEN f9_dw004_curr_min_rpmt > 0 AND f9_dw004_curr_dpd = 0 THEN 'Min Payment Made'
            WHEN f9_dw004_curr_dpd > 0 THEN 'Past Due'
            ELSE 'Other'
          END AS behavior
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt = (
          SELECT MAX(f9_dw004_bus_dt)
          FROM ${TABLES.financial_account_updates}
          WHERE f9_dw004_bus_dt <= @endDate
        )
          AND fx_dw004_loc_stat IN ('G', 'N')
          AND f9_dw004_stmt_due_dt IS NOT NULL
      )
      SELECT
        cycle_day,
        behavior,
        COUNT(*) AS accounts,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY cycle_day), 2) AS pct
      FROM pay_behavior
      GROUP BY 1, 2
      ORDER BY 1, CASE behavior
        WHEN 'Paid in Full' THEN 0 WHEN 'Min Payment Made' THEN 1
        WHEN 'Below Min Due' THEN 2 WHEN 'Past Due' THEN 3 WHEN 'Other' THEN 4
      END`,
      { endDate },
      env,
    ),
  ]);

  return {
    overview,
    revolveTrend,
    utilizationDistribution,
    dpdDistribution,
    balanceTrend,
    paymentBehavior,
  };
}

export const onRequest = createHandler({ section: "billing-cycle", queryFn: queryBillingCycle });
