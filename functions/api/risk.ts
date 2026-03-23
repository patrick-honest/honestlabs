import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";
import { cycleDateWhere } from "../_shared/filters";

async function queryRisk(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  const [dpdTrend, balanceExposure, dpdFirstStatement, dpdApplicationMonth] = await Promise.all([
    // DPD Distribution Trend — weekly snapshot with buckets
    // The page expects: week_start, current_count, dpd_1_30, dpd_31_60, dpd_61_90, dpd_90_plus, total_accounts, delinquency_rate_30plus
    runQuery(
      `WITH weekly_snapshot AS (
        SELECT
          FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(f9_dw004_bus_dt, ISOWEEK)) AS week_start,
          p9_dw004_loc_acct,
          f9_dw004_curr_dpd,
          f9_dw004_clo_bal,
          ROW_NUMBER() OVER (
            PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(f9_dw004_bus_dt, ISOWEEK))
            ORDER BY f9_dw004_bus_dt DESC
          ) AS rn
        FROM ${TABLES.financial_account_updates} dw4
        WHERE dw4.f9_dw004_bus_dt BETWEEN @startDate AND @endDate
          AND dw4.fx_dw004_loc_stat IN ('G', 'N')
          ${cycleDateWhere(filters, 'dw4')}
      ),
      snapshot AS (
        SELECT * FROM weekly_snapshot WHERE rn = 1
      )
      SELECT
        week_start,
        COUNTIF(f9_dw004_curr_dpd = 0) AS current_count,
        COUNTIF(f9_dw004_curr_dpd BETWEEN 1 AND 30) AS dpd_1_30,
        COUNTIF(f9_dw004_curr_dpd BETWEEN 31 AND 60) AS dpd_31_60,
        COUNTIF(f9_dw004_curr_dpd BETWEEN 61 AND 90) AS dpd_61_90,
        COUNTIF(f9_dw004_curr_dpd > 90) AS dpd_90_plus,
        COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts,
        ROUND(COUNTIF(f9_dw004_curr_dpd > 30) * 100.0 / COUNT(*), 2) AS delinquency_rate_30plus
      FROM snapshot
      GROUP BY week_start
      ORDER BY week_start`,
      { startDate, endDate },
      env,
    ),

    // Balance Exposure by DPD Bucket — point-in-time snapshot
    // The page expects: bucket, accounts, total_balance_idr
    runQuery(
      `WITH ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY p9_dw004_loc_acct
            ORDER BY f9_dw004_bus_dt DESC
          ) AS rn
        FROM ${TABLES.financial_account_updates} dw4
        WHERE dw4.f9_dw004_bus_dt <= @endDate
          AND dw4.fx_dw004_loc_stat IN ('G', 'N')
          ${cycleDateWhere(filters, 'dw4')}
      ),
      snapshot AS (
        SELECT * FROM ranked WHERE rn = 1
      )
      SELECT
        CASE
          WHEN f9_dw004_curr_dpd = 0 THEN 'Current'
          WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30'
          WHEN f9_dw004_curr_dpd BETWEEN 31 AND 60 THEN '31-60'
          WHEN f9_dw004_curr_dpd BETWEEN 61 AND 90 THEN '61-90'
          ELSE '90+'
        END AS bucket,
        COUNT(*) AS accounts,
        ROUND(SUM(f9_dw004_clo_bal / 100), 0) AS total_balance_idr
      FROM snapshot
      GROUP BY bucket
      ORDER BY
        CASE bucket
          WHEN 'Current' THEN 1
          WHEN '1-30' THEN 2
          WHEN '31-60' THEN 3
          WHEN '61-90' THEN 4
          ELSE 5
        END`,
      { endDate },
      env,
    ),

    // 30+ DPD on First Statement (monthly, all-time — no date params)
    runQuery(
      `WITH fnx_accounts AS (
        SELECT F9_DW001_LOC_ACCT, F9_DW001_LOC_LMT, PX_DW001_CRD_PGM,
          ct_dict.issuance_fee,
          ROW_NUMBER() OVER(PARTITION BY F9_DW001_LOC_ACCT ORDER BY f9_dw001_upd_tms DESC) AS rn
        FROM ${TABLES.new_card_application}
        LEFT JOIN ${TABLES.card_type_dictionary} ct_dict USING(PX_DW001_CRD_PGM)
        QUALIFY rn = 1
      ),
      xpd AS (
        SELECT xpd.application_status_id, dec.flag_FT,
          COALESCE(dec.is_account_opening_fee_applicable, FALSE) AS is_aof,
          fnx.issuance_fee,
          COALESCE(dec.is_prepaid_card_applicable, FALSE) AS is_rp1,
          fnx.F9_DW001_LOC_LMT AS initial_credit_limit,
          xpd.date_due_1,
          xpd.c1_pd30_obs, xpd.c1_pd30, xpd.v1_pd30_obs, xpd.v1_pd30
        FROM ${TABLES.ft_delinquency_xpd} xpd
        LEFT JOIN ${TABLES.ft_application_decision_base} dec USING(application_status_id)
        LEFT JOIN fnx_accounts fnx ON xpd.p9_dw004_loc_acct = fnx.F9_DW001_LOC_ACCT
      )
      SELECT
        FORMAT_DATE('%Y-%m', CASE
          WHEN EXTRACT(DAY FROM date_due_1) >= 15
          THEN DATE_TRUNC(DATE_ADD(date_due_1, INTERVAL 1 MONTH), MONTH)
          ELSE DATE_TRUNC(date_due_1, MONTH)
        END) AS month,
        SUM(c1_pd30_obs) AS c1_pd30_obs,
        SUM(c1_pd30) AS c1_pd30,
        SUM(v1_pd30_obs) AS v1_pd30_obs,
        SUM(v1_pd30) AS v1_pd30,
        ROUND(SAFE_DIVIDE(SUM(v1_pd30), SUM(v1_pd30_obs)) * 100, 2) AS pd30_rate_pct
      FROM xpd
      WHERE flag_FT = 0
        AND is_aof = FALSE AND COALESCE(issuance_fee, 0.0) = 0.0
        AND is_rp1 = FALSE AND initial_credit_limit > 1
      GROUP BY 1
      ORDER BY 1`,
      undefined,
      env,
    ),

    // 30+ DPD by Application Month (monthly, all-time — no date params)
    runQuery(
      `WITH fnx_accounts AS (
        SELECT F9_DW001_LOC_ACCT, F9_DW001_LOC_LMT, PX_DW001_CRD_PGM,
          ct_dict.issuance_fee,
          ROW_NUMBER() OVER(PARTITION BY F9_DW001_LOC_ACCT ORDER BY f9_dw001_upd_tms DESC) AS rn
        FROM ${TABLES.new_card_application}
        LEFT JOIN ${TABLES.card_type_dictionary} ct_dict USING(PX_DW001_CRD_PGM)
        QUALIFY rn = 1
      ),
      statement_date_mapping AS (
        SELECT p9_dw004_loc_acct, f9_dw004_stmt_due_dt AS due_date, f9_dw004_bus_dt AS statement_date
        FROM ${TABLES.financial_account_updates}
        WHERE EXTRACT(DAY FROM f9_dw004_bus_dt) = CAST(f9_dw004_cycc_day AS INT64)
      ),
      xpd AS (
        SELECT xpd.application_status_id, dec.flag_FT,
          COALESCE(dec.is_account_opening_fee_applicable, FALSE) AS is_aof,
          fnx.issuance_fee,
          COALESCE(dec.is_prepaid_card_applicable, FALSE) AS is_rp1,
          fnx.F9_DW001_LOC_LMT AS initial_credit_limit,
          xpd.application_received_date,
          dec.date_decision AS decision_date,
          sdm.due_date AS date_due_1_theo,
          xpd.c1_pd30_obs, xpd.c1_pd30, xpd.v1_pd30_obs, xpd.v1_pd30
        FROM ${TABLES.ft_delinquency_xpd} xpd
        LEFT JOIN ${TABLES.ft_application_decision_base} dec USING(application_status_id)
        LEFT JOIN statement_date_mapping sdm
          ON xpd.p9_dw004_loc_acct = sdm.p9_dw004_loc_acct
          AND DATE_ADD(xpd.application_received_date, INTERVAL 35 DAY) <= sdm.due_date
        LEFT JOIN fnx_accounts fnx ON xpd.p9_dw004_loc_acct = fnx.F9_DW001_LOC_ACCT
        QUALIFY ROW_NUMBER() OVER (PARTITION BY xpd.application_status_id ORDER BY sdm.due_date) = 1
      )
      SELECT
        FORMAT_DATE('%Y-%m', DATE_TRUNC(decision_date, MONTH)) AS month,
        SUM(c1_pd30_obs) AS c1_pd30_obs,
        SUM(c1_pd30) AS c1_pd30,
        SUM(v1_pd30_obs) AS v1_pd30_obs,
        SUM(v1_pd30) AS v1_pd30,
        ROUND(SAFE_DIVIDE(SUM(v1_pd30), SUM(v1_pd30_obs)) * 100, 2) AS pd30_rate_pct
      FROM xpd
      WHERE DATE_ADD(date_due_1_theo, INTERVAL 30 DAY) <= CURRENT_DATE()
        AND flag_FT = 0
        AND is_aof = FALSE AND COALESCE(issuance_fee, 0.0) = 0.0
        AND is_rp1 = FALSE AND initial_credit_limit > 1
      GROUP BY 1
      ORDER BY 1`,
      undefined,
      env,
    ),
  ]);

  return { dpdTrend, balanceExposure, dpdFirstStatement, dpdApplicationMonth };
}

export const onRequest = createHandler({ section: "risk", queryFn: queryRisk });
