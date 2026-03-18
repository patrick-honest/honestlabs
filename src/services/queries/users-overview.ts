import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountStatusRow {
  status: string;
  accounts: number;
}

export interface DeviceRow {
  manufacturer: string;
  os: string;
  users: number;
}

export interface DemographicRow {
  profession: string;
  education: string;
  income: string;
  users: number;
}

export interface VerificationRow {
  reason: string;
  users: number;
}

export interface GeographicRow {
  province: string;
  users: number;
}

// ---------------------------------------------------------------------------
// Account status distribution from latest DW004 snapshot
// ---------------------------------------------------------------------------

export async function getAccountStatusDistribution(): Promise<AccountStatusRow[]> {
  const sql = `
    SELECT
      fx_dw004_loc_stat AS status,
      COUNT(DISTINCT p9_dw004_loc_acct) AS accounts
    FROM ${TABLES.financial_account_updates}
    WHERE f9_dw004_bus_dt = (
      SELECT MAX(f9_dw004_bus_dt)
      FROM ${TABLES.financial_account_updates}
    )
    GROUP BY status
    ORDER BY accounts DESC
  `;
  return runQuery<AccountStatusRow>(sql);
}

// ---------------------------------------------------------------------------
// Device breakdown from milestone_complete
// ---------------------------------------------------------------------------

export async function getDeviceBreakdown(
  startDate: Date,
  endDate: Date,
): Promise<DeviceRow[]> {
  const sql = `
    SELECT
      context_device_manufacturer AS manufacturer,
      context_os_name AS os,
      COUNT(DISTINCT user_id) AS users
    FROM ${TABLES.milestone_complete}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      AND application_status = 'Decision complete'
    GROUP BY 1, 2
    ORDER BY users DESC
    LIMIT 15
  `;
  return runQuery<DeviceRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// Demographics from milestone_complete traits
// ---------------------------------------------------------------------------

export async function getDemographics(
  startDate: Date,
  endDate: Date,
): Promise<DemographicRow[]> {
  const sql = `
    SELECT
      context_traits_profession AS profession,
      context_traits_education_level AS education,
      context_traits_monthly_income AS income,
      COUNT(DISTINCT user_id) AS users
    FROM ${TABLES.milestone_complete}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      AND application_status = 'Decision complete'
    GROUP BY 1, 2, 3
    ORDER BY users DESC
    LIMIT 50
  `;
  return runQuery<DemographicRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// Verification breakdown from videocall_verified
// ---------------------------------------------------------------------------

export async function getVerificationBreakdown(
  startDate: Date,
  endDate: Date,
): Promise<VerificationRow[]> {
  const sql = `
    SELECT
      reason,
      COUNT(DISTINCT user_id) AS users
    FROM \`storage-58f5a02c.refined_rudderstack.videocall_verified\`
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY reason
    ORDER BY users DESC
  `;
  return runQuery<VerificationRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// Geographic distribution
// ---------------------------------------------------------------------------

export async function getGeographicDistribution(
  startDate: Date,
  endDate: Date,
): Promise<GeographicRow[]> {
  const sql = `
    SELECT
      context_traits_province AS province,
      COUNT(DISTINCT user_id) AS users
    FROM ${TABLES.milestone_complete}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      AND application_status = 'Decision complete'
    GROUP BY 1
    ORDER BY users DESC
    LIMIT 15
  `;
  return runQuery<GeographicRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
