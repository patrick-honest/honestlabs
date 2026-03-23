import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";
import { cycleDateWhere } from "../_shared/filters";

async function queryPortfolio(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  const [snapshot, statusBreakdown, creditLimitDist, revolveRateTrend, portfolioUtilizationTrend] = await Promise.all([
    runQuery(
      `SELECT FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(f9_dw004_bus_dt, ISOWEEK)) AS week_start,
        COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts, COUNTIF(fx_dw004_loc_stat IN ('G','N')) AS active_accounts,
        COUNTIF(fx_dw004_loc_stat='B') AS blocked_accounts, COUNTIF(fx_dw004_loc_stat='C') AS closed_accounts,
        ROUND(AVG(CAST(f9_dw004_loc_lmt AS FLOAT64)),2) AS avg_credit_limit, ROUND(AVG(CAST(f9_dw004_clo_bal AS FLOAT64)),2) AS avg_balance,
        ROUND(SAFE_DIVIDE(SUM(CAST(f9_dw004_clo_bal AS FLOAT64)), NULLIF(SUM(CAST(f9_dw004_loc_lmt AS FLOAT64)),0))*100,2) AS utilization_pct,
        COUNTIF(f9_dw004_curr_dpd>0) AS delinquent_accounts,
        ROUND(SAFE_DIVIDE(COUNTIF(f9_dw004_curr_dpd>0), COUNT(DISTINCT p9_dw004_loc_acct))*100,2) AS delinquency_rate
      FROM ${TABLES.financial_account_updates} dw4
      WHERE dw4.f9_dw004_bus_dt BETWEEN @startDate AND @endDate AND EXTRACT(DAYOFWEEK FROM dw4.f9_dw004_bus_dt)=1
        ${cycleDateWhere(filters, 'dw4')}
      GROUP BY week_start ORDER BY week_start`,
      { startDate, endDate }, env,
    ),
    runQuery(
      `SELECT dw4.fx_dw004_loc_stat AS status, COUNT(DISTINCT dw4.p9_dw004_loc_acct) AS accounts
      FROM ${TABLES.financial_account_updates} dw4
      WHERE dw4.f9_dw004_bus_dt=(SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates} WHERE f9_dw004_bus_dt<=@endDate)
        ${cycleDateWhere(filters, 'dw4')}
      GROUP BY status ORDER BY accounts DESC`,
      { endDate }, env,
    ),
    runQuery(
      `SELECT CASE WHEN CAST(dw4.f9_dw004_loc_lmt AS FLOAT64)<=1 THEN 'RP1 (<=1)' WHEN CAST(dw4.f9_dw004_loc_lmt AS FLOAT64)<=5000000 THEN '<=5M'
        WHEN CAST(dw4.f9_dw004_loc_lmt AS FLOAT64)<=10000000 THEN '5-10M' WHEN CAST(dw4.f9_dw004_loc_lmt AS FLOAT64)<=25000000 THEN '10-25M'
        WHEN CAST(dw4.f9_dw004_loc_lmt AS FLOAT64)<=50000000 THEN '25-50M' ELSE '>50M' END AS bucket,
        COUNT(DISTINCT dw4.p9_dw004_loc_acct) AS accounts
      FROM ${TABLES.financial_account_updates} dw4
      WHERE dw4.f9_dw004_bus_dt=(SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates} WHERE f9_dw004_bus_dt<=@endDate)
        AND dw4.fx_dw004_loc_stat IN ('G','N')
        ${cycleDateWhere(filters, 'dw4')}
      GROUP BY bucket ORDER BY MIN(CAST(dw4.f9_dw004_loc_lmt AS FLOAT64))`,
      { endDate }, env,
    ),

    // Revolve Rate (monthly, all-time — no date params)
    runQuery(
      `WITH fnx_accounts AS (
        SELECT F9_DW001_LOC_ACCT, F9_DW001_LOC_LMT, PX_DW001_CRD_PGM,
          ROW_NUMBER() OVER(PARTITION BY F9_DW001_LOC_ACCT ORDER BY f9_dw001_upd_tms DESC) AS rn
        FROM ${TABLES.new_card_application}
        QUALIFY rn = 1
      ),
      spend AS (
        SELECT FX_DW009_LOC_ACCT, MIN(P9_DW009_PST_DT) AS first_transact_date
        FROM ${TABLES.posted_transaction}
        WHERE F9_DW009_TXN_CDE IN ('1010', '1011')
        GROUP BY 1
      ),
      bal AS (
        SELECT P9_DW004_LOC_ACCT, F9_DW004_STMT_DUE_DT,
          GREATEST(F9_DW004_OPEN_BAL/100, 0) AS opening_balance,
          GREATEST(F9_DW004_OS_BILL_AMT/100, 0) AS total_outstanding_billed,
          FX_DW004_LOC_STAT AS status, F9_DW004_BUS_DT AS snapshot_date
        FROM ${TABLES.financial_account_updates}
        WHERE F9_DW004_BUS_DT = F9_DW004_STMT_DUE_DT
      )
      SELECT
        FORMAT_DATE('%Y-%m', DATE_TRUNC(b.snapshot_date, MONTH)) AS month,
        COUNT(*) AS cnt_accounts,
        SUM(IF(b.total_outstanding_billed > 0, 1, 0)) AS cnt_revolving,
        ROUND(SAFE_DIVIDE(SUM(IF(b.total_outstanding_billed > 0, 1, 0)), COUNT(*)) * 100, 2) AS revolve_rate_count_pct,
        ROUND(SAFE_DIVIDE(SUM(b.total_outstanding_billed), SUM(b.opening_balance)) * 100, 2) AS revolve_rate_balance_pct,
        ROUND(SUM(b.opening_balance), 0) AS statement_opening_balance,
        ROUND(SUM(b.total_outstanding_billed), 0) AS total_billed_outstanding
      FROM bal b
      LEFT JOIN ${TABLES.account_dpd_block_date} zn ON b.P9_DW004_LOC_ACCT = zn.loc_acct AND zn.date_first_zn_block <= b.snapshot_date
      LEFT JOIN spend s ON b.P9_DW004_LOC_ACCT = s.FX_DW009_LOC_ACCT AND s.first_transact_date <= b.snapshot_date
      LEFT JOIN fnx_accounts fnx ON b.P9_DW004_LOC_ACCT = fnx.F9_DW001_LOC_ACCT
      LEFT JOIN ${TABLES.mapping_loc_user} br ON b.P9_DW004_LOC_ACCT = br.loc_acct
      LEFT JOIN ${TABLES.ft_application_decision_base} dec USING(application_status_id)
      WHERE zn.date_first_zn_block IS NULL
        AND b.status NOT IN ('C', 'S', 'W', 'P')
        AND s.first_transact_date IS NOT NULL
        AND dec.flag_FT = 0
        AND COALESCE(dec.is_account_opening_fee_applicable, FALSE) = FALSE
        AND COALESCE(dec.is_prepaid_card_applicable, FALSE) = FALSE
        AND fnx.F9_DW001_LOC_LMT > 1
      GROUP BY 1
      ORDER BY 1`,
      undefined,
      env,
    ),

    // Portfolio Utilization / Avg Limit / Weighted Fee (monthly, all-time)
    runQuery(
      `WITH fnx_accounts AS (
        SELECT F9_DW001_LOC_ACCT, F9_DW001_LOC_LMT, PX_DW001_CRD_PGM,
          ct_dict.admin_fee,
          ROW_NUMBER() OVER(PARTITION BY F9_DW001_LOC_ACCT ORDER BY f9_dw001_upd_tms DESC) AS rn
        FROM ${TABLES.new_card_application}
        LEFT JOIN ${TABLES.card_type_dictionary} ct_dict USING(PX_DW001_CRD_PGM)
        QUALIFY rn = 1
      ),
      spend AS (
        SELECT FX_DW009_LOC_ACCT, MIN(P9_DW009_PST_DT) AS first_transact_date
        FROM ${TABLES.posted_transaction}
        WHERE F9_DW009_TXN_CDE IN ('1010', '1011')
        GROUP BY 1
      ),
      monthly_snap AS (
        SELECT P9_DW004_LOC_ACCT,
          DATE_TRUNC(F9_DW004_BUS_DT, MONTH) AS snap_month,
          F9_DW004_CLO_BAL / 100 AS closing_balance,
          CAST(F9_DW004_LOC_LMT AS FLOAT64) AS credit_limit,
          FX_DW004_LOC_STAT AS status,
          F9_DW004_BUS_DT AS bus_dt,
          ROW_NUMBER() OVER (PARTITION BY P9_DW004_LOC_ACCT, DATE_TRUNC(F9_DW004_BUS_DT, MONTH) ORDER BY F9_DW004_BUS_DT DESC) AS rn
        FROM ${TABLES.financial_account_updates}
      )
      SELECT
        FORMAT_DATE('%Y-%m', ms.snap_month) AS month,
        COUNT(*) AS cnt_accounts,
        ROUND(SAFE_DIVIDE(SUM(GREATEST(ms.closing_balance, 0)), NULLIF(SUM(ms.credit_limit), 0)) * 100, 2) AS utilization_rate_pct,
        ROUND(AVG(ms.credit_limit) / 16000, 2) AS portfolio_avg_credit_limit_usd,
        ROUND(SAFE_DIVIDE(
          SUM(fnx.admin_fee * GREATEST(ms.closing_balance, 0)),
          NULLIF(SUM(GREATEST(ms.closing_balance, 0)), 0)
        ) * 100, 2) AS portfolio_revolve_weighted_fee_pct
      FROM monthly_snap ms
      LEFT JOIN ${TABLES.account_dpd_block_date} zn ON ms.P9_DW004_LOC_ACCT = zn.loc_acct AND zn.date_first_zn_block <= ms.bus_dt
      LEFT JOIN spend s ON ms.P9_DW004_LOC_ACCT = s.FX_DW009_LOC_ACCT AND s.first_transact_date <= ms.bus_dt
      LEFT JOIN fnx_accounts fnx ON ms.P9_DW004_LOC_ACCT = fnx.F9_DW001_LOC_ACCT
      LEFT JOIN ${TABLES.mapping_loc_user} br ON ms.P9_DW004_LOC_ACCT = br.loc_acct
      LEFT JOIN ${TABLES.ft_application_decision_base} dec USING(application_status_id)
      WHERE ms.rn = 1
        AND zn.date_first_zn_block IS NULL
        AND ms.status NOT IN ('C', 'S', 'W', 'P')
        AND s.first_transact_date IS NOT NULL
        AND dec.flag_FT = 0
        AND COALESCE(dec.is_account_opening_fee_applicable, FALSE) = FALSE
        AND COALESCE(dec.is_prepaid_card_applicable, FALSE) = FALSE
        AND fnx.F9_DW001_LOC_LMT > 1
      GROUP BY 1
      ORDER BY 1`,
      undefined,
      env,
    ),
  ]);
  return { snapshot, statusBreakdown, creditLimitDist, revolveRateTrend, portfolioUtilizationTrend };
}

export const onRequest = createHandler({ section: "portfolio", queryFn: queryPortfolio });
