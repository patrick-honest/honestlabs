import { runQuery, TABLES } from "@/lib/bigquery";
import { maskRow } from "@/lib/pii";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserSearchResult {
  // Identity
  user_id: string;
  loc_acct: string | null;
  status: string | null;
  credit_limit: number | null;

  // Card info (latest + historical)
  prin_crn: string | null;
  urn: string | null;
  card_history: CardHistoryEntry[];

  // Account snapshot
  cycle_date: string | null;
  next_due_date: string | null;
  current_min_due: number | null;
  current_dpd: number | null;

  // Timeline
  decision_date: string | null;
  contract_id: string | null;
  contract_created_at: string | null;
  videocall_verified_date: string | null;
  card_activation_date: string | null;
  first_transaction_date: string | null;
  days_dormant: number | null;
}

export interface CardHistoryEntry {
  prin_crn: string;
  urn: string | null;
  bus_dt: string;
}

// ---------------------------------------------------------------------------
// User search
// ---------------------------------------------------------------------------

export async function searchUserById(
  userId: string,
): Promise<UserSearchResult | null> {
  const sql = `
    WITH loc AS (
      SELECT
        user_id,
        external_id AS loc_acct,
        status,
        credit_limit
      FROM ${TABLES.cms_line_of_credit}
      WHERE user_id = @userId
      LIMIT 1
    ),

    card_latest AS (
      SELECT
        dw5.f9_dw005_loc_acct AS loc_acct,
        dw5.f9_dw005_crn AS prin_crn,
        dw5.px_dw005_urn AS urn,
        dw5.f9_dw005_1st_unblk_all_mtd_tms AS activation_ts,
        dw5.f9_dw005_bus_dt AS bus_dt,
        ROW_NUMBER() OVER (
          PARTITION BY dw5.f9_dw005_loc_acct
          ORDER BY dw5.f9_dw005_bus_dt DESC
        ) AS rn
      FROM ${TABLES.principal_card_updates} dw5
      JOIN loc ON dw5.f9_dw005_loc_acct = loc.loc_acct
    ),

    card_history AS (
      SELECT
        f9_dw005_crn AS prin_crn,
        px_dw005_urn AS urn,
        FORMAT_DATE('%Y-%m-%d', f9_dw005_bus_dt) AS bus_dt,
        ROW_NUMBER() OVER (
          PARTITION BY f9_dw005_loc_acct
          ORDER BY f9_dw005_bus_dt DESC
        ) AS rn
      FROM ${TABLES.principal_card_updates} dw5
      JOIN loc ON dw5.f9_dw005_loc_acct = loc.loc_acct
    ),

    acct_snapshot AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', dw4.f9_dw004_nxt_cyc_dt) AS cycle_date,
        FORMAT_DATE('%Y-%m-%d', dw4.f9_dw004_nxt_pymt_due_dt) AS next_due_date,
        dw4.f9_dw004_min_pymt_due / 100.0 AS current_min_due,
        dw4.f9_dw004_curr_dpd AS current_dpd,
        ROW_NUMBER() OVER (ORDER BY dw4.f9_dw004_bus_dt DESC) AS rn
      FROM ${TABLES.financial_account_updates} dw4
      JOIN loc ON dw4.p9_dw004_loc_acct = loc.loc_acct
    ),

    decision AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(MIN(timestamp), 'Asia/Jakarta')) AS decision_date
      FROM ${TABLES.decision_completed}
      WHERE user_id = @userId
    ),

    contract AS (
      SELECT
        contract_id,
        FORMAT_TIMESTAMP('%Y-%m-%d', created_at, 'Asia/Jakarta') AS contract_created_at,
        ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
      FROM ${TABLES.customer_contract}
      WHERE user_id = @userId
    ),

    videocall AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(MIN(timestamp), 'Asia/Jakarta')) AS videocall_verified_date
      FROM ${TABLES.milestone_complete}
      WHERE user_id = @userId
        AND application_status = 'Videocall verified'
    ),

    first_txn AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', MIN(dw7.f9_dw007_dt)) AS first_transaction_date
      FROM ${TABLES.authorized_transaction} dw7
      JOIN card_latest cl ON dw7.f9_dw007_prin_crn = cl.prin_crn AND cl.rn = 1
      WHERE (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
        AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
    ),

    last_txn AS (
      SELECT
        MAX(dw7.f9_dw007_dt) AS last_txn_date
      FROM ${TABLES.authorized_transaction} dw7
      JOIN card_latest cl ON dw7.f9_dw007_prin_crn = cl.prin_crn AND cl.rn = 1
      WHERE (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
        AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
    )

    SELECT
      @userId AS user_id,
      loc.loc_acct,
      loc.status,
      loc.credit_limit,
      cl.prin_crn,
      cl.urn,
      acct.cycle_date,
      acct.next_due_date,
      acct.current_min_due,
      acct.current_dpd,
      d.decision_date,
      ct.contract_id,
      ct.contract_created_at,
      vc.videocall_verified_date,
      FORMAT_TIMESTAMP('%Y-%m-%d', cl.activation_ts, 'Asia/Jakarta') AS card_activation_date,
      ft.first_transaction_date,
      DATE_DIFF(CURRENT_DATE(), lt.last_txn_date, DAY) AS days_dormant
    FROM loc
    LEFT JOIN card_latest cl ON cl.rn = 1
    LEFT JOIN acct_snapshot acct ON acct.rn = 1
    LEFT JOIN decision d ON TRUE
    LEFT JOIN contract ct ON ct.rn = 1
    LEFT JOIN videocall vc ON TRUE
    LEFT JOIN first_txn ft ON TRUE
    LEFT JOIN last_txn lt ON TRUE
  `;

  const histSql = `
    SELECT
      dw5.f9_dw005_crn AS prin_crn,
      dw5.px_dw005_urn AS urn,
      FORMAT_DATE('%Y-%m-%d', dw5.f9_dw005_bus_dt) AS bus_dt
    FROM ${TABLES.principal_card_updates} dw5
    JOIN ${TABLES.cms_line_of_credit} cloc
      ON dw5.f9_dw005_loc_acct = cloc.external_id
    WHERE cloc.user_id = @userId
    ORDER BY dw5.f9_dw005_bus_dt DESC
    LIMIT 20
  `;

  const [mainRows, historyRows] = await Promise.all([
    runQuery<Record<string, unknown>>(sql, { userId }),
    runQuery<CardHistoryEntry>(histSql, { userId }),
  ]);

  if (mainRows.length === 0) return null;

  const masked = maskRow(mainRows[0]);

  return {
    user_id: masked.user_id as string,
    loc_acct: (masked.loc_acct as string) ?? null,
    status: (masked.status as string) ?? null,
    credit_limit: (masked.credit_limit as number) ?? null,
    prin_crn: (masked.prin_crn as string) ?? null,
    urn: (masked.urn as string) ?? null,
    card_history: historyRows,
    cycle_date: (masked.cycle_date as string) ?? null,
    next_due_date: (masked.next_due_date as string) ?? null,
    current_min_due: (masked.current_min_due as number) ?? null,
    current_dpd: (masked.current_dpd as number) ?? null,
    decision_date: (masked.decision_date as string) ?? null,
    contract_id: (masked.contract_id as string) ?? null,
    contract_created_at: (masked.contract_created_at as string) ?? null,
    videocall_verified_date: (masked.videocall_verified_date as string) ?? null,
    card_activation_date: (masked.card_activation_date as string) ?? null,
    first_transaction_date: (masked.first_transaction_date as string) ?? null,
    days_dormant: (masked.days_dormant as number) ?? null,
  };
}
