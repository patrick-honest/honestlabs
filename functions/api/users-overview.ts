import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";

async function queryUsersOverview(startDate: string, endDate: string, env: Env) {
  const [statusBreakdown, deviceBreakdown, geoDeepDive, accountGrowth] = await Promise.all([
    // Account Status Distribution from latest DW004 snapshot
    // Page expects: status, accounts
    runQuery(
      `SELECT
        fx_dw004_loc_stat AS status,
        COUNT(DISTINCT p9_dw004_loc_acct) AS accounts
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt = (
        SELECT MAX(f9_dw004_bus_dt)
        FROM ${TABLES.financial_account_updates}
      )
      GROUP BY status
      ORDER BY accounts DESC`,
      undefined,
      env,
    ),

    // Device breakdown from milestone_complete
    // Returns manufacturer, os, users — page splits into deviceManufacturers and osBreakdown
    runQuery(
      `SELECT
        context_device_manufacturer AS manufacturer,
        context_os_name AS os,
        COUNT(DISTINCT user_id) AS users
      FROM ${TABLES.milestone_complete}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        AND application_status = 'Decision complete'
      GROUP BY 1, 2
      ORDER BY users DESC
      LIMIT 15`,
      { startDate, endDate },
      env,
    ),

    // Geographic distribution
    // Page expects: province, users
    runQuery(
      `SELECT
        context_traits_province AS province,
        COUNT(DISTINCT user_id) AS users
      FROM ${TABLES.milestone_complete}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        AND application_status = 'Decision complete'
      GROUP BY 1
      ORDER BY users DESC
      LIMIT 15`,
      { startDate, endDate },
      env,
    ),

    // Account Growth Trend — monthly total + new accounts from DW004
    // Page expects: month, total_accounts, new_accounts
    runQuery(
      `WITH monthly AS (
        SELECT
          FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS month,
          p9_dw004_loc_acct,
          ROW_NUMBER() OVER (
            PARTITION BY p9_dw004_loc_acct, FORMAT_DATE('%Y-%m', f9_dw004_bus_dt)
            ORDER BY f9_dw004_bus_dt DESC
          ) AS rn
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
          AND fx_dw004_loc_stat IN ('G', 'N')
      ),
      monthly_counts AS (
        SELECT
          month,
          COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts
        FROM monthly
        WHERE rn = 1
        GROUP BY month
      ),
      first_seen AS (
        SELECT
          p9_dw004_loc_acct,
          FORMAT_DATE('%Y-%m', MIN(f9_dw004_bus_dt)) AS first_month
        FROM ${TABLES.financial_account_updates}
        WHERE fx_dw004_loc_stat IN ('G', 'N')
        GROUP BY p9_dw004_loc_acct
      ),
      new_counts AS (
        SELECT
          first_month AS month,
          COUNT(*) AS new_accounts
        FROM first_seen
        WHERE first_month BETWEEN FORMAT_DATE('%Y-%m', PARSE_DATE('%Y-%m-%d', @startDate))
          AND FORMAT_DATE('%Y-%m', PARSE_DATE('%Y-%m-%d', @endDate))
        GROUP BY first_month
      )
      SELECT
        mc.month,
        mc.total_accounts,
        COALESCE(nc.new_accounts, 0) AS new_accounts
      FROM monthly_counts mc
      LEFT JOIN new_counts nc ON mc.month = nc.month
      ORDER BY mc.month`,
      { startDate, endDate },
      env,
    ),
  ]);

  // Split device data into manufacturer and OS aggregations
  const deviceRows = deviceBreakdown as { manufacturer: string; os: string; users: number }[];

  const mfgMap = new Map<string, number>();
  const osMap = new Map<string, number>();
  for (const row of deviceRows) {
    mfgMap.set(row.manufacturer, (mfgMap.get(row.manufacturer) ?? 0) + row.users);
    osMap.set(row.os, (osMap.get(row.os) ?? 0) + row.users);
  }

  const deviceManufacturers = [...mfgMap.entries()]
    .map(([manufacturer, users]) => ({ manufacturer, users }))
    .sort((a, b) => b.users - a.users);

  const osBreakdown = [...osMap.entries()]
    .map(([os, users]) => ({ os, users }))
    .sort((a, b) => b.users - a.users);

  return {
    statusBreakdown,
    deviceManufacturers,
    osBreakdown,
    geoDeepDive: geoDeepDive,
    accountGrowth,
  };
}

export const onRequest = createHandler({ section: "users-overview", queryFn: queryUsersOverview });
