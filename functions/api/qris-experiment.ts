import { runQuery, TABLES } from "../_shared/bigquery-client";
import type { Env } from "../_shared/bigquery-auth";
import { getCached, setCached, cacheKey } from "../_shared/cache";

// ---------------------------------------------------------------------------
// Revenue rate constants
// ---------------------------------------------------------------------------
const CARD_INTERCHANGE_RATE = 0.016; // 1.6% blended Visa+MC (Kansas City Fed Aug 2025)
const QRIS_ISSUER_RATE = 0.002035; // 0.55% MDR x 37% issuer share (PBI No. 24/8/PBI/2022, PT ALTO)

// ---------------------------------------------------------------------------
// Shared CTE fragments
// ---------------------------------------------------------------------------

/** Base CTEs for clean cohort (with dynamic contamination detection) */
function cohortCTEs(startDate: string): string {
  return `
    credit_qris_exp AS (
      SELECT user_id, loc_acct, qris_test_rollout_group AS grp
      FROM ${TABLES.qris_rollout}
    ),
    cards AS (
      SELECT DISTINCT f9_dw005_loc_acct, f9_dw005_crn
      FROM ${TABLES.principal_card_updates}
      WHERE f9_dw005_loc_acct IS NOT NULL AND f9_dw005_crn IS NOT NULL
    ),
    contaminated AS (
      SELECT DISTINCT c.user_id
      FROM credit_qris_exp c
      JOIN cards k ON c.loc_acct = k.f9_dw005_loc_acct
      JOIN ${TABLES.authorized_transaction} t ON k.f9_dw005_crn = t.f9_dw007_prin_crn
      WHERE c.grp = 'Control'
        AND t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L'
        AND t.f9_dw007_dt >= '${startDate}'
        AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
    ),
    clean_cohort AS (
      SELECT c.user_id, c.loc_acct, c.grp
      FROM credit_qris_exp c
      WHERE NOT EXISTS (SELECT 1 FROM contaminated x WHERE x.user_id = c.user_id)
    )`;
}

// ---------------------------------------------------------------------------
// Query function
// ---------------------------------------------------------------------------

async function queryQrisExperiment(
  startDate: string,
  endDate: string,
  env: Env,
) {
  // Cohort/contamination always uses experiment start; transaction filters use the user's selected period
  const experimentStart = "2026-02-09";
  // Clamp startDate: can't look before experiment start for experiment data
  const effectiveStart = startDate < experimentStart ? experimentStart : startDate;

  const [
    cohortComparison,
    merchantClassification,
    qrisOnlyMerchantCount,
    qrisOnlyMerchantGrowth,
    interchangeProjection,
    cohortRpu,
    profitability,
    revenueTrajectory,
    incrementality,
  ] = await Promise.all([
    // -----------------------------------------------------------------------
    // (a) cohortComparison — Test vs Control headline metrics
    // -----------------------------------------------------------------------
    runQuery(
      `WITH ${cohortCTEs(experimentStart)},
      auth_trx AS (
        SELECT
          co.user_id, co.grp,
          CAST(t.f9_dw007_amt_req AS FLOAT64) / 100.0 AS spend_idr,
          CASE WHEN t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END AS is_qris
        FROM clean_cohort co
        JOIN cards k ON co.loc_acct = k.f9_dw005_loc_acct
        JOIN ${TABLES.authorized_transaction} t ON k.f9_dw005_crn = t.f9_dw007_prin_crn
        WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
          AND t.f9_dw007_ori_amt > 0
      ),
      user_spend AS (
        SELECT user_id, grp, COALESCE(SUM(spend_idr), 0) AS total_spend, COUNT(*) AS txn_count
        FROM auth_trx GROUP BY user_id, grp
      ),
      -- Include non-transactors (spend=0) for accurate stddev across entire cohort
      cohort_user_spend AS (
        SELECT co.user_id, co.grp,
          COALESCE(us.total_spend, 0) AS total_spend,
          COALESCE(us.txn_count, 0) AS txn_count
        FROM clean_cohort co
        LEFT JOIN user_spend us ON co.user_id = us.user_id
      ),
      grp_stddev AS (
        SELECT grp,
          ROUND(STDDEV_POP(total_spend), 2) AS std_dev_spend,
          ROUND(STDDEV_POP(CAST(txn_count AS FLOAT64)), 2) AS std_dev_txns
        FROM cohort_user_spend
        GROUP BY grp
      )
      SELECT
        co.grp,
        COUNT(DISTINCT co.user_id) AS cohort_size,
        COUNT(DISTINCT a.user_id) AS transactors,
        COUNT(DISTINCT CASE WHEN a.is_qris = 1 THEN a.user_id END) AS qris_users,
        ROUND(COALESCE(SUM(a.spend_idr), 0), 2) AS total_spend_idr,
        ROUND(COALESCE(SUM(CASE WHEN a.is_qris = 1 THEN a.spend_idr ELSE 0 END), 0), 2) AS qris_spend_idr,
        COUNT(a.user_id) AS total_txns,
        COALESCE(SUM(a.is_qris), 0) AS qris_txns,
        -- avg spend per ELIGIBLE user (cohort_size, not transactors)
        ROUND(COALESCE(SUM(a.spend_idr), 0) / NULLIF(COUNT(DISTINCT co.user_id), 0), 2) AS avg_spend_per_eligible_user,
        ROUND(CAST(COUNT(a.user_id) AS FLOAT64) / NULLIF(COUNT(DISTINCT a.user_id), 0), 1) AS txn_per_user,
        ROUND(100.0 * COUNT(DISTINCT a.user_id) / COUNT(DISTINCT co.user_id), 1) AS sar,
        -- For confidence intervals (pre-computed via JOIN, no correlated subquery)
        sd.std_dev_spend,
        sd.std_dev_txns
      FROM clean_cohort co
      LEFT JOIN auth_trx a ON co.user_id = a.user_id
      LEFT JOIN grp_stddev sd ON co.grp = sd.grp
      GROUP BY co.grp, sd.std_dev_spend, sd.std_dev_txns
      ORDER BY co.grp`,
      { startDate: effectiveStart, endDate },
      env,
    ),

    // -----------------------------------------------------------------------
    // (b) merchantClassification — QRIS + Card spend at classified merchants
    // Merchant history is ALL TIME; period spend uses startDate/endDate.
    // Also returns card spend per cohort at the same merchants for
    // cannibalization analysis, plus per-user std devs for CIs.
    // -----------------------------------------------------------------------
    runQuery(
      `WITH ${cohortCTEs(experimentStart)},
      -- All-time merchant classification (no date filter)
      merchant_history AS (
        SELECT
          fx_dw007_merc_name AS merchant,
          MAX(CASE WHEN fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END) AS has_qris,
          MAX(CASE WHEN fx_dw007_rte_dest != 'L' OR fx_dw007_rte_dest IS NULL THEN 1 ELSE 0 END) AS has_non_qris,
          MAX(CASE WHEN fx_dw007_rte_dest != 'L' AND fx_dw007_rte_dest != 'I'
                    AND fx_dw007_rte_dest IS NOT NULL THEN 1 ELSE 0 END) AS has_domestic_non_qris
        FROM ${TABLES.authorized_transaction}
        WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
          AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        GROUP BY merchant
      ),
      classified AS (
        SELECT merchant,
          CASE
            WHEN has_qris = 1 AND has_non_qris = 0 THEN 'QRIS-Only Merchants'
            WHEN has_qris = 1 AND has_non_qris = 1 AND has_domestic_non_qris = 0 THEN 'E-commerce Sites'
            WHEN has_qris = 1 AND has_non_qris = 1 THEN 'Mixed Merchants'
            ELSE 'Other'
          END AS merchant_type
        FROM merchant_history
        WHERE has_qris = 1
      ),
      final_class AS (
        SELECT merchant,
          CASE
            WHEN merchant_type = 'Mixed Merchants' AND (
              UPPER(merchant) LIKE '%SHOPEE%' OR UPPER(merchant) LIKE '%TOKOPEDIA%'
              OR UPPER(merchant) LIKE '%LAZADA%' OR UPPER(merchant) LIKE '%GRAB%'
              OR UPPER(merchant) LIKE '%GOJEK%' OR UPPER(merchant) LIKE '%BUKALAPAK%'
              OR UPPER(merchant) LIKE '%BLIBLI%' OR UPPER(merchant) LIKE '%TIKTOK%'
            ) THEN 'E-commerce Sites'
            ELSE merchant_type
          END AS merchant_type
        FROM classified
      ),
      -- ALL transactions (QRIS + card) at classified merchants, by cohort
      period_txns AS (
        SELECT
          co.user_id, co.grp, fc.merchant_type,
          CAST(t.f9_dw007_amt_req AS FLOAT64) / 100.0 AS spend_idr,
          CASE WHEN t.fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END AS is_qris
        FROM clean_cohort co
        JOIN cards k ON co.loc_acct = k.f9_dw005_loc_acct
        JOIN ${TABLES.authorized_transaction} t ON k.f9_dw005_crn = t.f9_dw007_prin_crn
        JOIN final_class fc ON t.fx_dw007_merc_name = fc.merchant
        WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
          AND t.f9_dw007_ori_amt > 0
      ),
      -- Per-user spend by merchant type for std dev
      user_segment_spend AS (
        SELECT user_id, grp, merchant_type,
          SUM(CASE WHEN is_qris = 1 THEN spend_idr ELSE 0 END) AS qris_spend,
          SUM(CASE WHEN is_qris = 0 THEN spend_idr ELSE 0 END) AS card_spend,
          SUM(spend_idr) AS total_spend
        FROM period_txns
        GROUP BY user_id, grp, merchant_type
      ),
      -- Std dev per segment (for CIs)
      segment_stddev AS (
        SELECT grp, merchant_type,
          ROUND(STDDEV_POP(total_spend), 2) AS std_dev_spend
        FROM user_segment_spend
        GROUP BY grp, merchant_type
      ),
      cohort_sz AS (
        SELECT grp, COUNT(DISTINCT user_id) AS sz FROM clean_cohort GROUP BY grp
      )
      SELECT
        p.grp, p.merchant_type,
        ROUND(SUM(CASE WHEN p.is_qris = 1 THEN p.spend_idr ELSE 0 END), 2) AS qris_spend_idr,
        COUNTIF(p.is_qris = 1) AS qris_txns,
        COUNT(DISTINCT CASE WHEN p.is_qris = 1 THEN p.user_id END) AS qris_users,
        ROUND(SUM(CASE WHEN p.is_qris = 0 THEN p.spend_idr ELSE 0 END), 2) AS card_spend_idr,
        COUNTIF(p.is_qris = 0) AS card_txns,
        COUNT(DISTINCT CASE WHEN p.is_qris = 0 THEN p.user_id END) AS card_users,
        ROUND(SUM(p.spend_idr), 2) AS total_spend_idr,
        cs.sz AS cohort_size,
        sd.std_dev_spend
      FROM period_txns p
      JOIN cohort_sz cs ON p.grp = cs.grp
      LEFT JOIN segment_stddev sd ON p.grp = sd.grp AND p.merchant_type = sd.merchant_type
      GROUP BY p.grp, p.merchant_type, cs.sz, sd.std_dev_spend
      ORDER BY p.grp, p.merchant_type`,
      { startDate: effectiveStart, endDate },
      env,
    ),

    // -----------------------------------------------------------------------
    // (c) qrisOnlyMerchantCount — All-time count of QRIS-only merchants
    // -----------------------------------------------------------------------
    runQuery(
      `SELECT
        COUNTIF(has_qris = 1 AND has_non_qris = 0) AS qris_only_merchants,
        COUNTIF(has_qris = 1 AND has_non_qris = 1) AS mixed_merchants,
        COUNTIF(has_qris = 0 AND has_non_qris = 1) AS non_qris_only_merchants
      FROM (
        SELECT
          fx_dw007_merc_name AS merchant,
          MAX(CASE WHEN fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END) AS has_qris,
          MAX(CASE WHEN fx_dw007_rte_dest != 'L' OR fx_dw007_rte_dest IS NULL THEN 1 ELSE 0 END) AS has_non_qris
        FROM ${TABLES.authorized_transaction}
        WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
          AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        GROUP BY merchant
      )`,
      undefined,
      env,
    ),

    // -----------------------------------------------------------------------
    // (d) qrisOnlyMerchantGrowth — Cumulative count of QRIS-only merchants over time
    // -----------------------------------------------------------------------
    runQuery(
      `WITH merchant_first_txn AS (
        SELECT
          fx_dw007_merc_name AS merchant,
          MIN(f9_dw007_dt) AS first_qris_date
        FROM ${TABLES.authorized_transaction}
        WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
          AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
          AND fx_dw007_rte_dest = 'L'
        GROUP BY merchant
        HAVING merchant NOT IN (
          SELECT DISTINCT fx_dw007_merc_name
          FROM ${TABLES.authorized_transaction}
          WHERE (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
            AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
            AND (fx_dw007_rte_dest != 'L' OR fx_dw007_rte_dest IS NULL)
        )
      ),
      monthly AS (
        SELECT DATE_TRUNC(first_qris_date, MONTH) AS mth, COUNT(*) AS new_merchants
        FROM merchant_first_txn GROUP BY mth
      )
      SELECT
        FORMAT_DATE('%Y-%m', mth) AS month,
        new_merchants,
        SUM(new_merchants) OVER (ORDER BY mth) AS cumulative_merchants
      FROM monthly
      ORDER BY mth`,
      undefined,
      env,
    ),

    // -----------------------------------------------------------------------
    // (e) interchangeProjection — Revenue breakdown per cohort
    // -----------------------------------------------------------------------
    runQuery(
      `WITH ${cohortCTEs(experimentStart)},
      auth_trx AS (
        SELECT
          co.user_id, co.grp,
          CAST(t.f9_dw007_amt_req AS FLOAT64) / 100.0 AS spend_idr,
          CASE WHEN t.fx_dw007_txn_typ = 'RA' AND t.fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END AS is_qris
        FROM clean_cohort co
        JOIN cards k ON co.loc_acct = k.f9_dw005_loc_acct
        JOIN ${TABLES.authorized_transaction} t ON k.f9_dw005_crn = t.f9_dw007_prin_crn
        WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
          AND t.f9_dw007_ori_amt > 0
      )
      SELECT
        co.grp,
        COUNT(DISTINCT co.user_id) AS cohort_size,
        ROUND(COALESCE(SUM(CASE WHEN a.is_qris = 0 THEN a.spend_idr ELSE 0 END), 0), 2) AS card_spend_idr,
        ROUND(COALESCE(SUM(CASE WHEN a.is_qris = 1 THEN a.spend_idr ELSE 0 END), 0), 2) AS qris_spend_idr,
        ROUND(COALESCE(SUM(a.spend_idr), 0), 2) AS total_spend_idr,
        ROUND(COALESCE(SUM(CASE WHEN a.is_qris = 0 THEN a.spend_idr ELSE 0 END), 0) * ${CARD_INTERCHANGE_RATE}, 2) AS card_interchange_idr,
        ROUND(COALESCE(SUM(CASE WHEN a.is_qris = 1 THEN a.spend_idr ELSE 0 END), 0) * ${QRIS_ISSUER_RATE}, 2) AS qris_issuer_revenue_idr,
        ROUND(
          COALESCE(SUM(CASE WHEN a.is_qris = 0 THEN a.spend_idr ELSE 0 END), 0) * ${CARD_INTERCHANGE_RATE}
          + COALESCE(SUM(CASE WHEN a.is_qris = 1 THEN a.spend_idr ELSE 0 END), 0) * ${QRIS_ISSUER_RATE},
        2) AS total_revenue_idr,
        ROUND(
          (COALESCE(SUM(CASE WHEN a.is_qris = 0 THEN a.spend_idr ELSE 0 END), 0) * ${CARD_INTERCHANGE_RATE}
           + COALESCE(SUM(CASE WHEN a.is_qris = 1 THEN a.spend_idr ELSE 0 END), 0) * ${QRIS_ISSUER_RATE})
          / NULLIF(COUNT(DISTINCT co.user_id), 0),
        2) AS revenue_per_user_idr
      FROM clean_cohort co
      LEFT JOIN auth_trx a ON co.user_id = a.user_id
      GROUP BY co.grp
      ORDER BY co.grp`,
      { startDate: effectiveStart, endDate },
      env,
    ),

    // -----------------------------------------------------------------------
    // (f) cohortRpu — Revenue per user including fees, interest, interchange
    // -----------------------------------------------------------------------
    runQuery(
      `WITH all_users AS (
        SELECT user_id, qris_test_rollout_group AS grp FROM ${TABLES.qris_rollout}
      ),
      contaminated_ctrl AS (
        SELECT DISTINCT u.user_id
        FROM all_users u
        JOIN ${TABLES.cms_line_of_credit} m ON u.user_id = m.user_id
        JOIN ${TABLES.principal_card_updates} p ON p.f9_dw005_loc_acct = m.external_id
        JOIN ${TABLES.authorized_transaction} t ON t.f9_dw007_prin_crn = p.f9_dw005_crn
        WHERE u.grp = 'Control' AND t.fx_dw007_rte_dest = 'L'
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
      ),
      credit_qris_exp AS (
        SELECT user_id, grp FROM all_users
        WHERE NOT (grp = 'Control' AND user_id IN (SELECT user_id FROM contaminated_ctrl))
      ),
      acct_map AS (
        SELECT c.user_id, c.grp, m.external_id AS loc_acct
        FROM credit_qris_exp c
        JOIN ${TABLES.cms_line_of_credit} m ON c.user_id = m.user_id
      ),
      cohort_size AS (
        SELECT grp, COUNT(DISTINCT user_id) AS sz FROM credit_qris_exp GROUP BY grp
      ),
      financials AS (
        SELECT a.grp,
          SUM(CAST(d.f9_dw004_tot_int AS FLOAT64) / 100) AS interest_idr,
          SUM(CAST(d.f9_dw004_bil_fee_chrg_1 AS FLOAT64) / 100) AS admin_fees_idr,
          SUM(CAST(d.f9_dw004_bil_fee_chrg_2 AS FLOAT64) / 100) AS late_penalty_fees_idr
        FROM acct_map a
        JOIN ${TABLES.financial_account_updates} d ON d.p9_dw004_loc_acct = a.loc_acct
        WHERE d.f9_dw004_bus_dt = (
          SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates}
          WHERE f9_dw004_bus_dt <= @endDate
        )
        GROUP BY a.grp
      ),
      txn_revenue AS (
        SELECT c.grp,
          ROUND(SUM(CASE WHEN t.fx_dw007_rte_dest != 'L' OR t.fx_dw007_rte_dest IS NULL
            THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 * ${CARD_INTERCHANGE_RATE} ELSE 0 END), 0) AS card_interchange_idr,
          ROUND(SUM(CASE WHEN t.fx_dw007_rte_dest = 'L'
            THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 * ${QRIS_ISSUER_RATE} ELSE 0 END), 0) AS qris_revenue_idr
        FROM ${TABLES.authorized_transaction} t
        JOIN ${TABLES.principal_card_updates} p ON p.f9_dw005_crn = t.f9_dw007_prin_crn
        JOIN ${TABLES.cms_line_of_credit} m ON m.external_id = p.f9_dw005_loc_acct
        JOIN credit_qris_exp c ON c.user_id = m.user_id
        WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        GROUP BY c.grp
      )
      SELECT
        f.grp,
        cs.sz AS cohort_size,
        ROUND(f.interest_idr, 0) AS interest_idr,
        ROUND(f.admin_fees_idr, 0) AS admin_fees_idr,
        ROUND(f.late_penalty_fees_idr, 0) AS late_penalty_fees_idr,
        tr.card_interchange_idr,
        tr.qris_revenue_idr,
        ROUND(f.interest_idr + f.admin_fees_idr + f.late_penalty_fees_idr, 0) AS fee_revenue_idr,
        ROUND(tr.card_interchange_idr + tr.qris_revenue_idr, 0) AS txn_revenue_idr,
        ROUND(f.interest_idr + f.admin_fees_idr + f.late_penalty_fees_idr + tr.card_interchange_idr + tr.qris_revenue_idr, 0) AS total_revenue_idr,
        ROUND((f.interest_idr + f.admin_fees_idr + f.late_penalty_fees_idr + tr.card_interchange_idr + tr.qris_revenue_idr) / cs.sz, 0) AS rpu_idr
      FROM financials f
      JOIN txn_revenue tr ON f.grp = tr.grp
      JOIN cohort_size cs ON f.grp = cs.grp
      ORDER BY f.grp`,
      { startDate: effectiveStart, endDate },
      env,
    ),

    // -----------------------------------------------------------------------
    // (g) profitability — Combined revenue view with ARPU
    // -----------------------------------------------------------------------
    runQuery(
      `WITH all_users AS (
        SELECT user_id, qris_test_rollout_group AS grp FROM ${TABLES.qris_rollout}
      ),
      contaminated_ctrl AS (
        SELECT DISTINCT u.user_id
        FROM all_users u
        JOIN ${TABLES.cms_line_of_credit} m ON u.user_id = m.user_id
        JOIN ${TABLES.principal_card_updates} p ON p.f9_dw005_loc_acct = m.external_id
        JOIN ${TABLES.authorized_transaction} t ON t.f9_dw007_prin_crn = p.f9_dw005_crn
        WHERE u.grp = 'Control' AND t.fx_dw007_rte_dest = 'L'
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
      ),
      credit_qris_exp AS (
        SELECT user_id, grp FROM all_users
        WHERE NOT (grp = 'Control' AND user_id IN (SELECT user_id FROM contaminated_ctrl))
      ),
      acct_map AS (
        SELECT c.user_id, c.grp, m.external_id AS loc_acct
        FROM credit_qris_exp c
        JOIN ${TABLES.cms_line_of_credit} m ON c.user_id = m.user_id
      ),
      cohort_size AS (
        SELECT grp, COUNT(DISTINCT user_id) AS sz FROM credit_qris_exp GROUP BY grp
      ),
      financials AS (
        SELECT a.grp,
          ROUND(SUM(CAST(d.f9_dw004_bil_fee_chrg_1 AS FLOAT64) / 100), 0) AS admin_fee_revenue,
          ROUND(SUM(CAST(d.f9_dw004_tot_int AS FLOAT64) / 100), 0) AS interest_revenue,
          ROUND(SUM(CAST(d.f9_dw004_bil_fee_chrg_2 AS FLOAT64) / 100), 0) AS late_penalty_fee_revenue
        FROM acct_map a
        JOIN ${TABLES.financial_account_updates} d ON d.p9_dw004_loc_acct = a.loc_acct
        WHERE d.f9_dw004_bus_dt = (
          SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates}
          WHERE f9_dw004_bus_dt <= @endDate
        )
        GROUP BY a.grp
      ),
      txn_rev AS (
        SELECT c.grp,
          ROUND(SUM(CASE WHEN t.fx_dw007_rte_dest != 'L' OR t.fx_dw007_rte_dest IS NULL
            THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 * ${CARD_INTERCHANGE_RATE} ELSE 0 END), 0) AS card_interchange_revenue,
          ROUND(SUM(CASE WHEN t.fx_dw007_rte_dest = 'L'
            THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 * ${QRIS_ISSUER_RATE} ELSE 0 END), 0) AS qris_mdr_revenue
        FROM ${TABLES.authorized_transaction} t
        JOIN ${TABLES.principal_card_updates} p ON p.f9_dw005_crn = t.f9_dw007_prin_crn
        JOIN ${TABLES.cms_line_of_credit} m ON m.external_id = p.f9_dw005_loc_acct
        JOIN credit_qris_exp c ON c.user_id = m.user_id
        WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        GROUP BY c.grp
      )
      SELECT
        f.grp,
        cs.sz AS cohort_size,
        f.admin_fee_revenue,
        f.interest_revenue,
        f.late_penalty_fee_revenue,
        tr.card_interchange_revenue,
        tr.qris_mdr_revenue,
        ROUND(f.admin_fee_revenue + f.interest_revenue + f.late_penalty_fee_revenue
          + tr.card_interchange_revenue + tr.qris_mdr_revenue, 0) AS total_revenue,
        ROUND((f.admin_fee_revenue + f.interest_revenue + f.late_penalty_fee_revenue
          + tr.card_interchange_revenue + tr.qris_mdr_revenue) / cs.sz, 0) AS arpu
      FROM financials f
      JOIN txn_rev tr ON f.grp = tr.grp
      JOIN cohort_size cs ON f.grp = cs.grp
      ORDER BY f.grp`,
      { startDate: effectiveStart, endDate },
      env,
    ),

    // -----------------------------------------------------------------------
    // (h) revenueTrajectory — Monthly fee vs interchange revenue per user
    //     for breakeven projection analysis
    // -----------------------------------------------------------------------
    runQuery(
      `WITH all_users AS (
        SELECT user_id, qris_test_rollout_group AS grp FROM ${TABLES.qris_rollout}
      ),
      contaminated_ctrl AS (
        SELECT DISTINCT u.user_id
        FROM all_users u
        JOIN ${TABLES.cms_line_of_credit} m ON u.user_id = m.user_id
        JOIN ${TABLES.principal_card_updates} p ON p.f9_dw005_loc_acct = m.external_id
        JOIN ${TABLES.authorized_transaction} t ON t.f9_dw007_prin_crn = p.f9_dw005_crn
        WHERE u.grp = 'Control' AND t.fx_dw007_rte_dest = 'L'
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
      ),
      credit_qris_exp AS (
        SELECT user_id, grp FROM all_users
        WHERE NOT (grp = 'Control' AND user_id IN (SELECT user_id FROM contaminated_ctrl))
      ),
      acct_map AS (
        SELECT c.user_id, c.grp, m.external_id AS loc_acct
        FROM credit_qris_exp c
        JOIN ${TABLES.cms_line_of_credit} m ON c.user_id = m.user_id
      ),
      cohort_size AS (
        SELECT grp, COUNT(DISTINCT user_id) AS sz FROM credit_qris_exp GROUP BY grp
      ),
      -- Monthly snapshots: last business day of each month
      monthly_dates AS (
        SELECT f9_dw004_bus_dt AS bus_dt, FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt >= '2026-02-01'
        QUALIFY ROW_NUMBER() OVER (PARTITION BY FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) ORDER BY f9_dw004_bus_dt DESC) = 1
      ),
      monthly_fees AS (
        SELECT md.month, a.grp, cs.sz AS cohort_size,
          ROUND(SUM(CAST(d.f9_dw004_tot_int AS FLOAT64) / 100), 0) AS interest_idr,
          ROUND(SUM(CAST(d.f9_dw004_bil_fee_chrg_1 AS FLOAT64) / 100), 0) AS admin_fees_idr,
          ROUND(SUM(CAST(d.f9_dw004_bil_fee_chrg_2 AS FLOAT64) / 100), 0) AS late_penalty_fees_idr,
          COUNTIF(CAST(d.f9_dw004_os_bill_amt AS FLOAT64) > 0) AS with_balance,
          COUNTIF(CAST(d.f9_dw004_os_bill_amt AS FLOAT64) > CAST(d.f9_dw004_curr_min_rpmt AS FLOAT64)
            AND CAST(d.f9_dw004_curr_min_rpmt AS FLOAT64) > 0) AS revolvers
        FROM acct_map a
        JOIN ${TABLES.financial_account_updates} d ON d.p9_dw004_loc_acct = a.loc_acct
        JOIN monthly_dates md ON d.f9_dw004_bus_dt = md.bus_dt
        JOIN cohort_size cs ON a.grp = cs.grp
        GROUP BY md.month, a.grp, cs.sz
      ),
      monthly_txn AS (
        SELECT FORMAT_DATE('%Y-%m', t.f9_dw007_dt) AS month, c.grp, cs.sz AS cohort_size,
          ROUND(SUM(CASE WHEN t.fx_dw007_rte_dest != 'L' OR t.fx_dw007_rte_dest IS NULL
            THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 * ${CARD_INTERCHANGE_RATE} ELSE 0 END), 0) AS card_interchange_idr,
          ROUND(SUM(CASE WHEN t.fx_dw007_rte_dest = 'L'
            THEN CAST(t.f9_dw007_amt_req AS FLOAT64) / 100 * ${QRIS_ISSUER_RATE} ELSE 0 END), 0) AS qris_revenue_idr
        FROM ${TABLES.authorized_transaction} t
        JOIN ${TABLES.principal_card_updates} p ON p.f9_dw005_crn = t.f9_dw007_prin_crn
        JOIN ${TABLES.cms_line_of_credit} m ON m.external_id = p.f9_dw005_loc_acct
        JOIN credit_qris_exp c ON c.user_id = m.user_id
        JOIN cohort_size cs ON c.grp = cs.grp
        WHERE t.f9_dw007_dt >= '2026-02-01'
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        GROUP BY month, c.grp, cs.sz
      )
      SELECT
        f.month, f.grp, f.cohort_size,
        f.revolvers,
        ROUND(SAFE_DIVIDE(f.revolvers, f.with_balance) * 100, 1) AS revolve_rate_pct,
        ROUND(SAFE_DIVIDE(f.interest_idr + f.admin_fees_idr + f.late_penalty_fees_idr, f.cohort_size), 0) AS fee_rpu,
        ROUND(SAFE_DIVIDE(COALESCE(tx.card_interchange_idr, 0) + COALESCE(tx.qris_revenue_idr, 0), f.cohort_size), 0) AS txn_rpu,
        ROUND(SAFE_DIVIDE(
          f.interest_idr + f.admin_fees_idr + f.late_penalty_fees_idr
          + COALESCE(tx.card_interchange_idr, 0) + COALESCE(tx.qris_revenue_idr, 0),
          f.cohort_size), 0) AS total_rpu,
        f.interest_idr, f.admin_fees_idr, f.late_penalty_fees_idr,
        COALESCE(tx.card_interchange_idr, 0) AS card_interchange_idr,
        COALESCE(tx.qris_revenue_idr, 0) AS qris_revenue_idr
      FROM monthly_fees f
      LEFT JOIN monthly_txn tx ON f.month = tx.month AND f.grp = tx.grp
      ORDER BY f.month, f.grp`,
      undefined,
      env,
    ),

    // -----------------------------------------------------------------------
    // (i) incrementality — User-level spend classification
    //     Dormant = no txns in 60 days before experiment start
    //     If first txn is QRIS → all their spend is incremental
    //     Active first-QRIS → subsequent card spend also incremental
    // -----------------------------------------------------------------------
    runQuery(
      `WITH ${cohortCTEs(experimentStart)},
      user_txns AS (
        SELECT co.user_id, co.grp, t.f9_dw007_dt AS txn_date,
          CAST(t.f9_dw007_amt_req AS FLOAT64) / 100.0 AS spend_idr,
          CASE WHEN t.fx_dw007_rte_dest = 'L' THEN 1 ELSE 0 END AS is_qris
        FROM clean_cohort co
        JOIN cards k ON co.loc_acct = k.f9_dw005_loc_acct
        JOIN ${TABLES.authorized_transaction} t ON k.f9_dw005_crn = t.f9_dw007_prin_crn
        WHERE (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF') AND t.f9_dw007_ori_amt > 0
      ),
      recent_active AS (
        SELECT DISTINCT user_id FROM user_txns
        WHERE txn_date BETWEEN DATE_SUB(DATE '${experimentStart}', INTERVAL 60 DAY) AND DATE_SUB(DATE '${experimentStart}', INTERVAL 1 DAY)
      ),
      first_exp_txn AS (
        SELECT user_id, grp,
          ARRAY_AGG(is_qris ORDER BY txn_date, is_qris DESC LIMIT 1)[OFFSET(0)] AS first_is_qris
        FROM user_txns WHERE txn_date >= '${experimentStart}'
        GROUP BY user_id, grp
      ),
      user_class AS (
        SELECT f.user_id, f.grp,
          CASE
            WHEN r.user_id IS NULL AND f.first_is_qris = 1 THEN 'dormant_qris_reactivated'
            WHEN r.user_id IS NULL AND f.first_is_qris = 0 THEN 'dormant_card_reactivated'
            WHEN r.user_id IS NOT NULL AND f.first_is_qris = 1 THEN 'active_first_qris'
            ELSE 'active_first_card'
          END AS user_type
        FROM first_exp_txn f
        LEFT JOIN recent_active r ON f.user_id = r.user_id
      )
      SELECT uc.grp, uc.user_type,
        COUNT(DISTINCT uc.user_id) AS users,
        ROUND(SUM(ut.spend_idr), 0) AS total_spend,
        ROUND(SUM(CASE WHEN ut.is_qris = 1 THEN ut.spend_idr ELSE 0 END), 0) AS qris_spend,
        ROUND(SUM(CASE WHEN ut.is_qris = 0 THEN ut.spend_idr ELSE 0 END), 0) AS card_spend,
        COUNT(*) AS txns
      FROM user_class uc
      JOIN user_txns ut ON uc.user_id = ut.user_id AND ut.txn_date >= '${experimentStart}'
      GROUP BY uc.grp, uc.user_type
      ORDER BY uc.grp, uc.user_type`,
      undefined,
      env,
    ),
  ]);

  return {
    cohortComparison,
    merchantClassification,
    qrisOnlyMerchantCount: (qrisOnlyMerchantCount as unknown[])[0] ?? null,
    qrisOnlyMerchantGrowth,
    interchangeProjection,
    cohortRpu,
    profitability,
    revenueTrajectory,
    incrementality,
  };
}

/**
 * Custom handler for QRIS experiment — does NOT extend startDate backwards.
 * The experiment has a fixed start date (2026-02-09); the user's selected
 * period should directly filter transactions, not be extended for chart context.
 */
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  if (!startDate || !endDate) {
    return new Response(
      JSON.stringify({ error: "Missing startDate or endDate query parameters" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const key = cacheKey("qris-experiment", "query", `${startDate}:${endDate}`);
    const cached = await getCached<unknown>(key, env.KPI_CACHE);
    if (cached && cached.fresh) {
      return new Response(JSON.stringify(cached.data), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300", "X-Cache": "HIT-FRESH" },
      });
    }

    const result = await queryQrisExperiment(startDate, endDate, env);
    await setCached(key, result, env.KPI_CACHE, 1800);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300", "X-Cache": "MISS" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch qris-experiment data", message: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
