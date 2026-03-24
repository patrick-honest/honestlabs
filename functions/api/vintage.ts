import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";

async function queryVintage(_startDate: string, _endDate: string, env: Env, _filters: ParsedFilters) {
  const [dpdByAppMonth, dpdByFirstStatement, cureRate] = await Promise.all([
    // -----------------------------------------------------------------------
    // (a) 30+ DPD Rate by Application (Decision) Month
    // Vintage delinquency — groups by decision_date month, requires 30 days
    // past first due date before reporting to ensure observation window.
    // Excludes FT, AOF, Rp1 customers.
    // -----------------------------------------------------------------------
    runQuery(
      `WITH fnx_accounts AS (
        SELECT F9_DW001_LOC_ACCT, F9_DW001_LOC_LMT,
          ROW_NUMBER() OVER(PARTITION BY F9_DW001_LOC_ACCT ORDER BY f9_dw001_upd_tms DESC) AS rn
        FROM ${TABLES.new_card_application}
      ),
      xpd AS (
        SELECT
          xpd.application_status_id,
          dec.date_decision AS decision_date,
          xpd.date_due_1,
          xpd.c1_pd4_obs, xpd.c1_pd4, xpd.v1_pd4_obs, xpd.v1_pd4,
          xpd.c1_pd10_obs, xpd.c1_pd10, xpd.v1_pd10_obs, xpd.v1_pd10,
          xpd.c1_pd30_obs, xpd.c1_pd30, xpd.v1_pd30_obs, xpd.v1_pd30
        FROM \`storage-58f5a02c.sandbox_risk.ft_delinquency_xpd\` xpd
        LEFT JOIN \`storage-58f5a02c.sandbox_risk.ft_application_decision_base\` dec USING(application_status_id)
        LEFT JOIN fnx_accounts fa ON xpd.p9_dw004_loc_acct = fa.F9_DW001_LOC_ACCT AND fa.rn = 1
        WHERE dec.flag_FT = 0
          AND COALESCE(dec.is_account_opening_fee_applicable, FALSE) = FALSE
          AND COALESCE(dec.is_prepaid_card_applicable, FALSE) = FALSE
          AND COALESCE(fa.F9_DW001_LOC_LMT, 2) > 1
      )
      SELECT
        FORMAT_DATE('%Y-%m', DATE_TRUNC(decision_date, MONTH)) AS month_key,
        SUM(c1_pd4_obs) AS c1_pd4_obs, SUM(c1_pd4) AS c1_pd4,
        ROUND(SAFE_DIVIDE(SUM(v1_pd4), SUM(v1_pd4_obs)) * 100, 2) AS v1_pd4_rate,
        SUM(c1_pd10_obs) AS c1_pd10_obs, SUM(c1_pd10) AS c1_pd10,
        ROUND(SAFE_DIVIDE(SUM(v1_pd10), SUM(v1_pd10_obs)) * 100, 2) AS v1_pd10_rate,
        SUM(c1_pd30_obs) AS c1_pd30_obs, SUM(c1_pd30) AS c1_pd30,
        ROUND(SAFE_DIVIDE(SUM(v1_pd30), SUM(v1_pd30_obs)) * 100, 2) AS v1_pd30_rate
      FROM xpd
      WHERE DATE_ADD(date_due_1, INTERVAL 30 DAY) <= CURRENT_DATE()
      GROUP BY 1
      ORDER BY 1`,
      undefined,
      env,
    ),

    // -----------------------------------------------------------------------
    // (b) 30+ DPD Rate by First Statement Due Date
    // Similar to (a) but grouped by the billing month of the first statement.
    // Adjusted for cycle day >= 15 (shifts to next month).
    // -----------------------------------------------------------------------
    runQuery(
      `WITH fnx_accounts AS (
        SELECT F9_DW001_LOC_ACCT, F9_DW001_LOC_LMT,
          ROW_NUMBER() OVER(PARTITION BY F9_DW001_LOC_ACCT ORDER BY f9_dw001_upd_tms DESC) AS rn
        FROM ${TABLES.new_card_application}
      ),
      xpd AS (
        SELECT
          xpd.date_due_1,
          xpd.c1_pd30_obs, xpd.c1_pd30, xpd.v1_pd30_obs, xpd.v1_pd30
        FROM \`storage-58f5a02c.sandbox_risk.ft_delinquency_xpd\` xpd
        LEFT JOIN \`storage-58f5a02c.sandbox_risk.ft_application_decision_base\` dec USING(application_status_id)
        LEFT JOIN fnx_accounts fa ON xpd.p9_dw004_loc_acct = fa.F9_DW001_LOC_ACCT AND fa.rn = 1
        WHERE dec.flag_FT = 0
          AND COALESCE(dec.is_account_opening_fee_applicable, FALSE) = FALSE
          AND COALESCE(dec.is_prepaid_card_applicable, FALSE) = FALSE
          AND COALESCE(fa.F9_DW001_LOC_LMT, 2) > 1
      )
      SELECT
        FORMAT_DATE('%Y-%m',
          CASE WHEN EXTRACT(DAY FROM date_due_1) >= 15
            THEN DATE_TRUNC(DATE_ADD(date_due_1, INTERVAL 1 MONTH), MONTH)
            ELSE DATE_TRUNC(date_due_1, MONTH)
          END
        ) AS month_key,
        SUM(c1_pd30_obs) AS c1_pd30_obs,
        SUM(c1_pd30) AS c1_pd30,
        ROUND(SAFE_DIVIDE(SUM(c1_pd30), SUM(c1_pd30_obs)) * 100, 2) AS c1_pd30_rate,
        ROUND(SAFE_DIVIDE(SUM(v1_pd30), SUM(v1_pd30_obs)) * 100, 2) AS v1_pd30_rate
      FROM xpd
      GROUP BY 1
      ORDER BY 1`,
      undefined,
      env,
    ),

    // -----------------------------------------------------------------------
    // (c) Cure Rate — 30-day collection recovery rate by billing month
    // Uses pre-built sandbox table. Measures % of delinquent balance
    // recovered within 27-30 days post-due.
    // -----------------------------------------------------------------------
    runQuery(
      `WITH prep AS (
        SELECT
          CASE
            WHEN EXTRACT(DAY FROM due_date) >= 15
            THEN DATE_TRUNC(DATE_ADD(due_date, INTERVAL 1 MONTH), MONTH)
            ELSE DATE_TRUNC(due_date, MONTH)
          END AS month_due_date,
          days_post_due,
          SUM(clobal_cured) AS clobal_cured,
          SUM(clo_bal) AS total_clobal
        FROM \`storage-58f5a02c.sandbox_risk.collection_cure_rate_raw\`
        WHERE fl_ft = 0 AND dpd_bi = 1
        GROUP BY 1, 2
      ),
      with_cum AS (
        SELECT *,
          SUM(clobal_cured) OVER (PARTITION BY month_due_date ORDER BY days_post_due) AS cumul_cured,
          SUM(total_clobal) OVER (PARTITION BY month_due_date) AS total_bal
        FROM prep
      )
      SELECT
        FORMAT_DATE('%Y-%m', month_due_date) AS month_key,
        ROUND(SAFE_DIVIDE(cumul_cured, total_bal) * 100, 1) AS cure_rate_pct,
        cumul_cured,
        total_bal
      FROM with_cum
      WHERE days_post_due BETWEEN 27 AND 30
      QUALIFY ROW_NUMBER() OVER (PARTITION BY month_due_date ORDER BY days_post_due DESC) = 1
      ORDER BY month_due_date`,
      undefined,
      env,
    ),
  ]);

  return {
    dpdByAppMonth,
    dpdByFirstStatement,
    cureRate,
  };
}

export const onRequest = createHandler({
  section: "vintage",
  queryFn: queryVintage,
  cacheTtl: 7200, // 2 hours — vintage data changes slowly
});
