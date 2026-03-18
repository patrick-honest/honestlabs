import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeSeriesRow {
  date: string;
  value: number;
}

// ---------------------------------------------------------------------------
// Supported metric keys and their BQ queries
// ---------------------------------------------------------------------------

type MetricQueryFn = (startDate: Date, endDate: Date) => Promise<TimeSeriesRow[]>;

const METRIC_QUERIES: Record<string, MetricQueryFn> = {
  eligible_count: async (startDate, endDate) => {
    const sql = `
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS date,
        COUNT(DISTINCT p9_dw004_loc_acct) AS value
      FROM ${TABLES.financial_account_updates}
      WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
        AND f9_dw004_acct_stat IN ('A', 'D', 'B')
      GROUP BY date
      ORDER BY date
    `;
    return runQuery<TimeSeriesRow>(sql, {
      startDate: toSqlDate(startDate),
      endDate: toSqlDate(endDate),
    });
  },

  transactor_count: async (startDate, endDate) => {
    const sql = `
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw007_dt) AS date,
        COUNT(DISTINCT f9_dw007_prin_crn) AS value
      FROM ${TABLES.authorized_transaction}
      WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY date
      ORDER BY date
    `;
    return runQuery<TimeSeriesRow>(sql, {
      startDate: toSqlDate(startDate),
      endDate: toSqlDate(endDate),
    });
  },

  spend_active_rate: async (startDate, endDate) => {
    const sql = `
      WITH eligible AS (
        SELECT
          FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS date,
          p9_dw004_loc_acct AS loc_acct
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
          AND f9_dw004_acct_stat IN ('A', 'D', 'B')
        GROUP BY date, loc_acct
      ),
      transactors AS (
        SELECT
          FORMAT_DATE('%Y-%m', t.f9_dw007_dt) AS date,
          cloc.external_id AS loc_acct
        FROM ${TABLES.authorized_transaction} t
        JOIN ${TABLES.cms_line_of_credit} cloc
          ON t.f9_dw007_prin_crn = cloc.external_id
        WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
          AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
          AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        GROUP BY date, loc_acct
      )
      SELECT
        e.date,
        ROUND(COUNT(DISTINCT t.loc_acct) * 100.0 / NULLIF(COUNT(DISTINCT e.loc_acct), 0), 2) AS value
      FROM eligible e
      LEFT JOIN transactors t
        ON e.date = t.date AND e.loc_acct = t.loc_acct
      GROUP BY e.date
      ORDER BY e.date
    `;
    return runQuery<TimeSeriesRow>(sql, {
      startDate: toSqlDate(startDate),
      endDate: toSqlDate(endDate),
    });
  },

  total_spend: async (startDate, endDate) => {
    const sql = `
      SELECT
        FORMAT_DATE('%Y-%m', f9_dw007_dt) AS date,
        ROUND(SUM(f9_dw007_bill_amt / 100.0), 0) AS value
      FROM ${TABLES.authorized_transaction}
      WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      GROUP BY date
      ORDER BY date
    `;
    return runQuery<TimeSeriesRow>(sql, {
      startDate: toSqlDate(startDate),
      endDate: toSqlDate(endDate),
    });
  },

  dpd_30_rate: async (startDate, endDate) => {
    const sql = `
      WITH monthly_snapshot AS (
        SELECT
          FORMAT_DATE('%Y-%m', f9_dw004_bus_dt) AS date,
          p9_dw004_loc_acct,
          MAX(f9_dw004_curr_dpd) AS max_dpd
        FROM ${TABLES.financial_account_updates}
        WHERE f9_dw004_bus_dt BETWEEN @startDate AND @endDate
          AND f9_dw004_acct_stat IN ('A', 'D', 'B')
        GROUP BY date, p9_dw004_loc_acct
      )
      SELECT
        date,
        ROUND(COUNTIF(max_dpd >= 30) * 100.0 / NULLIF(COUNT(*), 0), 2) AS value
      FROM monthly_snapshot
      GROUP BY date
      ORDER BY date
    `;
    return runQuery<TimeSeriesRow>(sql, {
      startDate: toSqlDate(startDate),
      endDate: toSqlDate(endDate),
    });
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const SUPPORTED_METRICS = Object.keys(METRIC_QUERIES);

export async function getTimeSeriesForMetric(
  metricKey: string,
  startDate: Date,
  endDate: Date,
): Promise<TimeSeriesRow[]> {
  const queryFn = METRIC_QUERIES[metricKey];
  if (!queryFn) {
    throw new Error(`Unsupported metric key: ${metricKey}. Supported: ${SUPPORTED_METRICS.join(", ")}`);
  }
  return queryFn(startDate, endDate);
}
