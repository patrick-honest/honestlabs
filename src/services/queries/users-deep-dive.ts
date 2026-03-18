import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountStatusBreakdownRow {
  status: string;
  accounts: number;
}

export interface DeviceManufacturerRow {
  manufacturer: string;
  users: number;
}

export interface GeographicRow {
  province: string;
  users: number;
}

export interface AccountGrowthRow {
  month: string;
  total_accounts: number;
  new_accounts: number;
}

export interface OsBreakdownRow {
  os: string;
  users: number;
}

// ---------------------------------------------------------------------------
// 1. Account status breakdown — latest snapshot <= endDate
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
      SELECT MAX(f9_dw004_bus_dt)
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt <= @endDate
    )
    GROUP BY status
    ORDER BY accounts DESC
  `;
  return runQuery<AccountStatusBreakdownRow>(sql, {
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 2. Device manufacturer breakdown from rudderstack users
// ---------------------------------------------------------------------------

export async function getDeviceBreakdown(): Promise<DeviceManufacturerRow[]> {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(context_device_manufacturer), ''), 'Unknown') AS manufacturer,
      COUNT(DISTINCT context_traits_user_id) AS users
    FROM ${TABLES.rudderstack_users}
    WHERE context_device_manufacturer IS NOT NULL
    GROUP BY manufacturer
    ORDER BY users DESC
    LIMIT 15
  `;
  return runQuery<DeviceManufacturerRow>(sql);
}

// ---------------------------------------------------------------------------
// 3. OS breakdown from rudderstack users
// ---------------------------------------------------------------------------

export async function getOsBreakdown(): Promise<OsBreakdownRow[]> {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(context_os_name), ''), 'Unknown') AS os,
      COUNT(DISTINCT context_traits_user_id) AS users
    FROM ${TABLES.rudderstack_users}
    WHERE context_os_name IS NOT NULL
    GROUP BY os
    ORDER BY users DESC
    LIMIT 10
  `;
  return runQuery<OsBreakdownRow>(sql);
}

// ---------------------------------------------------------------------------
// 4. Geographic distribution from milestone_complete traits
// ---------------------------------------------------------------------------

export async function getGeographicDistribution(
  startDate: Date,
  endDate: Date,
): Promise<GeographicRow[]> {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(context_traits_province), ''), 'Unknown') AS province,
      COUNT(DISTINCT user_id) AS users
    FROM ${TABLES.milestone_complete}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      AND application_status = 'Decision complete'
    GROUP BY 1
    ORDER BY users DESC
    LIMIT 20
  `;
  return runQuery<GeographicRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 5. Monthly account growth from DW004
// ---------------------------------------------------------------------------

export async function getAccountGrowthTrend(
  startDate: Date,
  endDate: Date,
): Promise<AccountGrowthRow[]> {
  const sql = `
    WITH monthly AS (
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
        f9_dw004_bus_dt,
        ROW_NUMBER() OVER (
          PARTITION BY FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)
          ORDER BY f9_dw004_bus_dt DESC
        ) AS rn,
        COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
      GROUP BY 1, 2
    )
    SELECT
      month,
      total_accounts,
      total_accounts - LAG(total_accounts) OVER (ORDER BY month) AS new_accounts
    FROM monthly
    WHERE rn = 1
    ORDER BY month
  `;
  return runQuery<AccountGrowthRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
