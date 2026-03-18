import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountStatusRow {
  status: string;
  count: number;
  balance_exposure: number;
}

export interface DpdDistributionRow {
  dpd_bucket: string;
  accounts: number;
  balance: number;
}

export interface CreditLimitDistributionRow {
  limit_bucket: string;
  accounts: number;
}

export interface AccountGrowthRow {
  month: string;
  total_active: number;
  new_accounts: number;
}

export interface BalanceDistributionRow {
  balance_bucket: string;
  accounts: number;
}

export interface PortfolioSnapshotRow {
  week_start: string;
  total_accounts: number;
  active_accounts: number;
  blocked_accounts: number;
  closed_accounts: number;
  avg_credit_limit: number;
  avg_balance: number;
  utilization_pct: number;
  delinquent_accounts: number;
  delinquency_rate: number;
}

export interface AccountStatusBreakdownRow {
  status: string;
  accounts: number;
}

export interface CreditLimitBucketRow {
  bucket: string;
  accounts: number;
}

// ---------------------------------------------------------------------------
// Helper: last snapshot per month using ROW_NUMBER
// ---------------------------------------------------------------------------

const LAST_SNAPSHOT_CTE = `
  WITH ranked AS (
    SELECT *,
      ROW_NUMBER() OVER (
        PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)
        ORDER BY f9_dw004_bus_dt DESC
      ) AS rn
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
  ),
  snapshot AS (
    SELECT * FROM ranked WHERE rn = 1
  )
`;

// ---------------------------------------------------------------------------
// 1. Account Status Distribution (point-in-time snapshot)
// ---------------------------------------------------------------------------

export async function getAccountStatusDistribution(
  busDate: Date,
): Promise<AccountStatusRow[]> {
  const sql = `
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt <= @busDate
    ),
    snapshot AS (
      SELECT * FROM ranked WHERE rn = 1
    )
    SELECT
      CASE fx_dw004_loc_stat
        WHEN 'G' THEN 'Good'
        WHEN 'N' THEN 'Normal'
        WHEN 'W' THEN 'Write-off'
        WHEN 'P' THEN 'Blocked'
        WHEN 'S' THEN 'Suspended'
        WHEN 'C' THEN 'Closed'
        ELSE fx_dw004_loc_stat
      END AS status,
      COUNT(*) AS count,
      ROUND(SUM(f9_dw004_clo_bal / 100), 0) AS balance_exposure
    FROM snapshot
    GROUP BY status
    ORDER BY count DESC
  `;

  return runQuery<AccountStatusRow>(sql, { busDate: toSqlDate(busDate) });
}

// ---------------------------------------------------------------------------
// 2. DPD Distribution (active accounts at a point-in-time)
// ---------------------------------------------------------------------------

export async function getDpdDistribution(
  busDate: Date,
): Promise<DpdDistributionRow[]> {
  const sql = `
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt <= @busDate
    ),
    snapshot AS (
      SELECT * FROM ranked WHERE rn = 1
      AND fx_dw004_loc_stat IN ('G', 'N')
    )
    SELECT
      CASE
        WHEN f9_dw004_curr_dpd = 0 THEN 'Current'
        WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30'
        WHEN f9_dw004_curr_dpd BETWEEN 31 AND 60 THEN '31-60'
        WHEN f9_dw004_curr_dpd BETWEEN 61 AND 90 THEN '61-90'
        ELSE '90+'
      END AS dpd_bucket,
      COUNT(*) AS accounts,
      ROUND(SUM(f9_dw004_clo_bal / 100), 0) AS balance
    FROM snapshot
    GROUP BY dpd_bucket
    ORDER BY
      CASE dpd_bucket
        WHEN 'Current' THEN 1
        WHEN '1-30' THEN 2
        WHEN '31-60' THEN 3
        WHEN '61-90' THEN 4
        ELSE 5
      END
  `;

  return runQuery<DpdDistributionRow>(sql, { busDate: toSqlDate(busDate) });
}

// ---------------------------------------------------------------------------
// 3. Credit Limit Distribution (active accounts at a point-in-time)
// ---------------------------------------------------------------------------

export async function getCreditLimitDistribution(
  busDate: Date,
): Promise<CreditLimitDistributionRow[]> {
  const sql = `
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt <= @busDate
    ),
    snapshot AS (
      SELECT * FROM ranked WHERE rn = 1
      AND fx_dw004_loc_stat IN ('G', 'N')
    )
    SELECT
      CASE
        WHEN f9_dw004_loc_lmt / 100 < 5000000 THEN '0-5M'
        WHEN f9_dw004_loc_lmt / 100 < 10000000 THEN '5-10M'
        WHEN f9_dw004_loc_lmt / 100 < 15000000 THEN '10-15M'
        WHEN f9_dw004_loc_lmt / 100 < 20000000 THEN '15-20M'
        WHEN f9_dw004_loc_lmt / 100 < 30000000 THEN '20-30M'
        ELSE '30M+'
      END AS limit_bucket,
      COUNT(*) AS accounts
    FROM snapshot
    GROUP BY limit_bucket
    ORDER BY
      CASE limit_bucket
        WHEN '0-5M' THEN 1
        WHEN '5-10M' THEN 2
        WHEN '10-15M' THEN 3
        WHEN '15-20M' THEN 4
        WHEN '20-30M' THEN 5
        ELSE 6
      END
  `;

  return runQuery<CreditLimitDistributionRow>(sql, { busDate: toSqlDate(busDate) });
}

// ---------------------------------------------------------------------------
// 4. Account Growth Trend (monthly active + new accounts)
// ---------------------------------------------------------------------------

export async function getAccountGrowthTrend(
  startDate: Date,
  endDate: Date,
): Promise<AccountGrowthRow[]> {
  const sql = `
    WITH monthly_snapshot AS (
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
        p9_dw004_loc_acct,
        fx_dw004_loc_stat,
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
    ),
    active_per_month AS (
      SELECT
        month,
        COUNT(DISTINCT p9_dw004_loc_acct) AS total_active
      FROM monthly_snapshot
      WHERE rn = 1 AND fx_dw004_loc_stat IN ('G', 'N')
      GROUP BY month
    ),
    first_active AS (
      SELECT
        p9_dw004_loc_acct,
        MIN(FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)) AS first_month
      FROM ${TABLES.financial_account_updates}
      WHERE fx_dw004_loc_stat IN ('G', 'N')
      GROUP BY p9_dw004_loc_acct
    ),
    new_per_month AS (
      SELECT
        first_month AS month,
        COUNT(*) AS new_accounts
      FROM first_active
      WHERE first_month BETWEEN FORMAT_DATE('%Y-%m', @startDate) AND FORMAT_DATE('%Y-%m', @endDate)
      GROUP BY first_month
    )
    SELECT
      a.month,
      a.total_active,
      COALESCE(n.new_accounts, 0) AS new_accounts
    FROM active_per_month a
    LEFT JOIN new_per_month n ON a.month = n.month
    ORDER BY a.month
  `;

  return runQuery<AccountGrowthRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 5. Balance Distribution (active accounts at a point-in-time)
// ---------------------------------------------------------------------------

export async function getBalanceDistribution(
  busDate: Date,
): Promise<BalanceDistributionRow[]> {
  const sql = `
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY p9_dw004_loc_acct
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt <= @busDate
    ),
    snapshot AS (
      SELECT * FROM ranked WHERE rn = 1
      AND fx_dw004_loc_stat IN ('G', 'N')
    )
    SELECT
      CASE
        WHEN f9_dw004_clo_bal / 100 <= 0 THEN 'Zero/Credit'
        WHEN f9_dw004_clo_bal / 100 < 1000000 THEN '0-1M'
        WHEN f9_dw004_clo_bal / 100 < 5000000 THEN '1-5M'
        WHEN f9_dw004_clo_bal / 100 < 10000000 THEN '5-10M'
        WHEN f9_dw004_clo_bal / 100 < 20000000 THEN '10-20M'
        ELSE '20M+'
      END AS balance_bucket,
      COUNT(*) AS accounts
    FROM snapshot
    GROUP BY balance_bucket
    ORDER BY
      CASE balance_bucket
        WHEN 'Zero/Credit' THEN 1
        WHEN '0-1M' THEN 2
        WHEN '1-5M' THEN 3
        WHEN '5-10M' THEN 4
        WHEN '10-20M' THEN 5
        ELSE 6
      END
  `;

  return runQuery<BalanceDistributionRow>(sql, { busDate: toSqlDate(busDate) });
}

// ---------------------------------------------------------------------------
// 6. Portfolio Weekly Snapshot — weekly health metrics
// ---------------------------------------------------------------------------

export async function getPortfolioSnapshot(
  startDate: Date,
  endDate: Date,
): Promise<PortfolioSnapshotRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(f9_dw004_bus_dt, ISOWEEK)) AS week_start,
      COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts,
      COUNTIF(fx_dw004_loc_stat IN ('G', 'N')) AS active_accounts,
      COUNTIF(fx_dw004_loc_stat = 'B') AS blocked_accounts,
      COUNTIF(fx_dw004_loc_stat = 'C') AS closed_accounts,
      ROUND(AVG(CAST(f9_dw004_loc_lmt AS FLOAT64)), 2) AS avg_credit_limit,
      ROUND(AVG(CAST(f9_dw004_cur_bal AS FLOAT64)), 2) AS avg_balance,
      ROUND(SAFE_DIVIDE(SUM(CAST(f9_dw004_cur_bal AS FLOAT64)), NULLIF(SUM(CAST(f9_dw004_loc_lmt AS FLOAT64)), 0)) * 100, 2) AS utilization_pct,
      COUNTIF(f9_dw004_curr_dpd > 0) AS delinquent_accounts,
      ROUND(SAFE_DIVIDE(COUNTIF(f9_dw004_curr_dpd > 0), COUNT(DISTINCT p9_dw004_loc_acct)) * 100, 2) AS delinquency_rate
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
      AND EXTRACT(DAYOFWEEK FROM f9_dw004_bus_dt) = 1
    GROUP BY week_start
    ORDER BY week_start
  `;

  return runQuery<PortfolioSnapshotRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 7. Account Status Breakdown — latest snapshot
// ---------------------------------------------------------------------------

export async function getAccountStatusBreakdown(
  endDate: Date,
): Promise<AccountStatusBreakdownRow[]> {
  const sql = `
    SELECT
      fx_dw004_loc_stat AS status,
      COUNT(DISTINCT p9_dw004_loc_acct) AS accounts
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt = (
      SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates} WHERE f9_dw004_bus_dt <= @endDate
    )
    GROUP BY status
    ORDER BY accounts DESC
  `;

  return runQuery<AccountStatusBreakdownRow>(sql, {
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 8. Credit Limit Distribution (bucketed) — latest snapshot, active only
// ---------------------------------------------------------------------------

export async function getCreditLimitBuckets(
  endDate: Date,
): Promise<CreditLimitBucketRow[]> {
  const sql = `
    SELECT
      CASE
        WHEN CAST(f9_dw004_loc_lmt AS FLOAT64) <= 1 THEN 'RP1 (<=1)'
        WHEN CAST(f9_dw004_loc_lmt AS FLOAT64) <= 5000000 THEN '<=5M'
        WHEN CAST(f9_dw004_loc_lmt AS FLOAT64) <= 10000000 THEN '5-10M'
        WHEN CAST(f9_dw004_loc_lmt AS FLOAT64) <= 25000000 THEN '10-25M'
        WHEN CAST(f9_dw004_loc_lmt AS FLOAT64) <= 50000000 THEN '25-50M'
        ELSE '>50M'
      END AS bucket,
      COUNT(DISTINCT p9_dw004_loc_acct) AS accounts
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt = (
      SELECT MAX(f9_dw004_bus_dt) FROM ${TABLES.financial_account_updates} WHERE f9_dw004_bus_dt <= @endDate
    )
      AND fx_dw004_loc_stat IN ('G', 'N')
    GROUP BY bucket
    ORDER BY MIN(CAST(f9_dw004_loc_lmt AS FLOAT64))
  `;

  return runQuery<CreditLimitBucketRow>(sql, {
    endDate: toSqlDate(endDate),
  });
}
