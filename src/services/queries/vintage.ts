import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VintageCohortRow {
  cohort_month: string;
  mob: number;
  approved_count: number;
  activated_count: number;
  delinquent_count: number;
  total_exposure_idr: number;
}

// ---------------------------------------------------------------------------
// Vintage Cohort Analysis
// ---------------------------------------------------------------------------

export async function getVintageCohorts(
  startMonth: Date,
  endMonth: Date,
): Promise<VintageCohortRow[]> {
  const sql = `
    WITH approved_users AS (
      SELECT
        user_id,
        DATE(MIN(timestamp), 'Asia/Jakarta') AS approval_date,
        FORMAT_DATE('%Y-%m', DATE(MIN(timestamp), 'Asia/Jakarta')) AS cohort_month
      FROM ${TABLES.decision_completed}
      WHERE decision = 'APPROVED'
        -- Product type filtering handled by UI (productType filter dimension)
      GROUP BY user_id
      HAVING DATE(MIN(timestamp), 'Asia/Jakarta') BETWEEN @startMonth AND @endMonth
    ),

    user_acct AS (
      SELECT
        au.user_id,
        au.approval_date,
        au.cohort_month,
        cloc.external_id AS loc_acct
      FROM approved_users au
      JOIN ${TABLES.cms_line_of_credit} cloc
        ON au.user_id = cloc.user_id
    ),

    user_crn AS (
      SELECT
        ua.user_id,
        ua.approval_date,
        ua.cohort_month,
        ua.loc_acct,
        dw4.p9_dw004_prin_crn AS crn,
        ROW_NUMBER() OVER (PARTITION BY ua.user_id ORDER BY dw4.p9_dw004_prin_crn) AS rn
      FROM user_acct ua
      JOIN ${TABLES.financial_account_updates} dw4
        ON ua.loc_acct = dw4.p9_dw004_loc_acct
    ),

    cohort AS (
      SELECT DISTINCT
        user_id,
        approval_date,
        cohort_month,
        loc_acct,
        crn
      FROM user_crn
      WHERE rn = 1
    ),

    -- Monthly snapshots: for each cohort, track metrics at each MOB
    mob_series AS (
      SELECT mob FROM UNNEST(GENERATE_ARRAY(0, 24)) AS mob
    ),

    cohort_mob AS (
      SELECT
        c.cohort_month,
        m.mob,
        DATE_ADD(DATE_TRUNC(c.approval_date, MONTH), INTERVAL m.mob MONTH) AS snapshot_month_start,
        DATE_ADD(DATE_ADD(DATE_TRUNC(c.approval_date, MONTH), INTERVAL (m.mob + 1) MONTH), INTERVAL -1 DAY) AS snapshot_month_end,
        c.user_id,
        c.loc_acct,
        c.crn
      FROM cohort c
      CROSS JOIN mob_series m
      WHERE DATE_ADD(DATE_TRUNC(c.approval_date, MONTH), INTERVAL m.mob MONTH) <= CURRENT_DATE()
    ),

    -- Count approved per cohort (constant across MOBs)
    approved_counts AS (
      SELECT
        cohort_month,
        COUNT(DISTINCT user_id) AS approved_count
      FROM cohort
      GROUP BY cohort_month
    ),

    -- Activated = has at least 1 valid txn by that MOB
    activated_by_mob AS (
      SELECT DISTINCT
        cm.cohort_month,
        cm.mob,
        cm.user_id
      FROM cohort_mob cm
      JOIN ${TABLES.authorized_transaction} dw7
        ON cm.crn = dw7.f9_dw007_prin_crn
       AND dw7.f9_dw007_dt <= cm.snapshot_month_end
      WHERE (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
        AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
    ),

    -- Delinquent = entered 30+ DPD at that MOB snapshot
    delinquent_by_mob AS (
      SELECT DISTINCT
        cm.cohort_month,
        cm.mob,
        cm.user_id
      FROM cohort_mob cm
      JOIN ${TABLES.financial_account_updates} dw4
        ON cm.loc_acct = dw4.p9_dw004_loc_acct
       AND dw4.f9_dw004_bus_dt BETWEEN cm.snapshot_month_start AND cm.snapshot_month_end
      WHERE dw4.f9_dw004_curr_dpd >= 30
    ),

    -- Exposure at end of MOB
    exposure_by_mob AS (
      SELECT
        cm.cohort_month,
        cm.mob,
        ROUND(SUM(dw4.f9_dw004_clo_bal / 100.0), 0) AS total_exposure_idr
      FROM cohort_mob cm
      JOIN ${TABLES.financial_account_updates} dw4
        ON cm.loc_acct = dw4.p9_dw004_loc_acct
       AND dw4.f9_dw004_bus_dt = cm.snapshot_month_end
      GROUP BY cm.cohort_month, cm.mob
    )

    SELECT
      ac.cohort_month,
      ms.mob,
      ac.approved_count,
      COALESCE(COUNT(DISTINCT act.user_id), 0) AS activated_count,
      COALESCE(COUNT(DISTINCT del.user_id), 0) AS delinquent_count,
      COALESCE(exp.total_exposure_idr, 0) AS total_exposure_idr
    FROM approved_counts ac
    CROSS JOIN mob_series ms
    LEFT JOIN activated_by_mob act
      ON ac.cohort_month = act.cohort_month AND ms.mob = act.mob
    LEFT JOIN delinquent_by_mob del
      ON ac.cohort_month = del.cohort_month AND ms.mob = del.mob
    LEFT JOIN exposure_by_mob exp
      ON ac.cohort_month = exp.cohort_month AND ms.mob = exp.mob
    WHERE DATE_ADD(PARSE_DATE('%Y-%m', ac.cohort_month), INTERVAL ms.mob MONTH) <= CURRENT_DATE()
    GROUP BY ac.cohort_month, ms.mob, ac.approved_count, exp.total_exposure_idr
    ORDER BY ac.cohort_month, ms.mob
  `;

  return runQuery<VintageCohortRow>(sql, {
    startMonth: toSqlDate(startMonth),
    endMonth: toSqlDate(endMonth),
  });
}
