import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivationRateTrendRow {
  week: string;
  approved_count: number;
  activated_count: number;
  rate: number;
}

export interface DaysToFirstTxnRow {
  days_bucket: string;
  count: number;
}

export interface ActivationByProductRow {
  product_type: string;
  approved: number;
  activated: number;
  rate: number;
}

export interface PinSetRateTrendRow {
  week: string;
  decision_count: number;
  pin_set_count: number;
  rate: number;
}

// ---------------------------------------------------------------------------
// 1. Activation Rate Trend — weekly approved vs activated (1st txn ≤7d)
// ---------------------------------------------------------------------------

export async function getActivationRateTrend(
  startDate: Date,
  endDate: Date,
): Promise<ActivationRateTrendRow[]> {
  const sql = `
    WITH approved AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week,
        user_id
      FROM ${TABLES.decision_completed}
      WHERE decision = 'approved'
        AND DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
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
        AND a_ts.decision = 'approved'
      INNER JOIN ${TABLES.cms_line_of_credit} loc
        ON a.user_id = loc.user_id
      INNER JOIN ${TABLES.principal_card_updates} pc
        ON loc.external_id = pc.f9_dw005_loc_acct
      INNER JOIN ${TABLES.authorized_transaction} t
        ON pc.f9_dw005_crn = t.f9_dw007_prin_crn
        AND t.fx_dw007_stat = 'N'
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
    ORDER BY a.week
  `;

  return runQuery<ActivationRateTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Days to First Transaction — distribution buckets
// ---------------------------------------------------------------------------

export async function getDaysToFirstTransaction(
  startDate: Date,
  endDate: Date,
): Promise<DaysToFirstTxnRow[]> {
  const sql = `
    WITH approved_users AS (
      SELECT
        user_id,
        MIN(DATE(timestamp, 'Asia/Jakarta')) AS approval_date
      FROM ${TABLES.decision_completed}
      WHERE decision = 'approved'
        AND DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY user_id
    ),
    first_txn AS (
      SELECT
        au.user_id,
        au.approval_date,
        MIN(DATE(t.f9_dw007_dt)) AS first_txn_date
      FROM approved_users au
      INNER JOIN ${TABLES.cms_line_of_credit} loc ON au.user_id = loc.user_id
      INNER JOIN ${TABLES.principal_card_updates} pc ON loc.external_id = pc.f9_dw005_loc_acct
      INNER JOIN ${TABLES.authorized_transaction} t
        ON pc.f9_dw005_crn = t.f9_dw007_prin_crn
        AND t.fx_dw007_stat = 'N'
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
      END
  `;

  return runQuery<DaysToFirstTxnRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 3. Activation by Product Type — RP1 vs standard vs opening fee
// ---------------------------------------------------------------------------

export async function getActivationByProductType(
  startDate: Date,
  endDate: Date,
): Promise<ActivationByProductRow[]> {
  const sql = `
    WITH approved AS (
      SELECT
        user_id,
        MIN(DATE(timestamp, 'Asia/Jakarta')) AS approval_date,
        CASE
          WHEN LOGICAL_OR(is_prepaid_card_applicable = true) THEN 'RP1'
          WHEN LOGICAL_OR(is_account_opening_fee_applicable = true) THEN 'Opening Fee'
          ELSE 'Standard CC'
        END AS product_type
      FROM ${TABLES.decision_completed}
      WHERE decision = 'approved'
        AND DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY user_id
    ),
    first_txn AS (
      SELECT
        a.user_id,
        MIN(DATE(t.f9_dw007_dt)) AS first_txn_date
      FROM approved a
      INNER JOIN ${TABLES.cms_line_of_credit} loc ON a.user_id = loc.user_id
      INNER JOIN ${TABLES.principal_card_updates} pc ON loc.external_id = pc.f9_dw005_loc_acct
      INNER JOIN ${TABLES.authorized_transaction} t
        ON pc.f9_dw005_crn = t.f9_dw007_prin_crn
        AND t.fx_dw007_stat = 'N'
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
    ORDER BY approved DESC
  `;

  return runQuery<ActivationByProductRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 4. Dormancy Analysis — account status buckets from DW004
// ---------------------------------------------------------------------------

export interface DormancyBucketRow {
  bucket: string;
  accounts: number;
}

export async function getDormancyAnalysis(
  endDate: Date,
): Promise<DormancyBucketRow[]> {
  const sql = `
    SELECT
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
    GROUP BY bucket
  `;

  return runQuery<DormancyBucketRow>(sql, {
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 5. PIN Set Rate Trend — weekly decision vs first-unblock (PIN set proxy)
// ---------------------------------------------------------------------------

export async function getPinSetRateTrend(
  startDate: Date,
  endDate: Date,
): Promise<PinSetRateTrendRow[]> {
  const sql = `
    WITH decisions AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week,
        user_id
      FROM ${TABLES.decision_completed}
      WHERE decision = 'approved'
        AND DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    ),
    pin_set AS (
      SELECT DISTINCT
        d.user_id,
        d.week
      FROM decisions d
      INNER JOIN ${TABLES.cms_line_of_credit} loc ON d.user_id = loc.user_id
      INNER JOIN ${TABLES.principal_card_updates} pc ON loc.external_id = pc.f9_dw005_loc_acct
      WHERE pc.f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL
    )
    SELECT
      d.week,
      COUNT(DISTINCT d.user_id) AS decision_count,
      COUNT(DISTINCT ps.user_id) AS pin_set_count,
      ROUND(SAFE_DIVIDE(COUNT(DISTINCT ps.user_id), COUNT(DISTINCT d.user_id)) * 100, 2) AS rate
    FROM decisions d
    LEFT JOIN pin_set ps ON d.user_id = ps.user_id AND d.week = ps.week
    GROUP BY d.week
    ORDER BY d.week
  `;

  return runQuery<PinSetRateTrendRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
