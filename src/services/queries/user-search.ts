import { runQuery, TABLES } from "@/lib/bigquery";
import { maskRow } from "@/lib/pii";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserSearchResult {
  // Identity
  user_id: string;
  loc_acct: string | null;
  prin_crn: string | null;
  current_urn: string | null;
  current_urn_date: string | null;
  card_type: string | null;       // fx_dw005_crd_prd: P=Physical, V=Virtual
  card_pgm: string | null;        // fx_dw005_crd_pgm raw code (e.g. "10021")
  product_type: string | null;    // human-readable product type
  card_brand: string | null;      // fx_dw005_crd_brn: VS=Visa, MC=Mastercard
  credit_limit: number | null;

  // Previous URNs (descending order by date)
  previous_urns: UrnHistoryEntry[];

  // Timeline
  decision_date: string | null;
  pin_set_date: string | null;
  videocall_verified_date: string | null;
  card_activation_date: string | null;
  cma_accepted_date: string | null; // Cardholder agreement accepted date
  cma_app_version: string | null;   // App version when CMA was signed

  // Account snapshot
  account_status: string | null;  // fx_dw004_loc_stat
  cycle_date: string | null;
  next_due_date: string | null;
  current_min_due: number | null;
  current_dpd: number | null;
  collections_status: string | null; // fx_dw004_coll_stat_cde

  // Banking
  savings_account_number: string | null;

  // Delivery
  awb_number: string | null;
  awb_status: string | null;
  delivery_date: string | null;     // terminal_time from delivery tracking

  // Blocks / Restrictions
  card_status: string | null;       // fx_dw005_crd_stat
  restriction_status: string | null; // fx_dw004_restrct_stat
  has_spending_block: boolean;

  // Repayment history
  repayment_history: RepaymentEntry[];

  // Freshworks
  open_tickets: FreshworksTicket[];
  ticket_history: FreshworksTicket[];
}

export interface RepaymentEntry {
  repayment_code: string | null;
  vendor: string | null;
  amount: string | null;
  currency: string | null;
  date: string | null;
}

export interface UrnHistoryEntry {
  urn: string;
  date: string;
}

export interface FreshworksTicket {
  ticket_id: string;
  subject: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

export interface CardHistoryEntry {
  prin_crn: string;
  urn: string | null;
  bus_dt: string;
}

// ---------------------------------------------------------------------------
// Resolve alternate identifiers to user_id
// ---------------------------------------------------------------------------

export async function resolveToUserId(
  field: string,
  value: string,
): Promise<string | null> {
  let sql: string;
  let params: Record<string, string>;

  switch (field) {
    case "loc":
      sql = `SELECT user_id FROM ${TABLES.cms_line_of_credit} WHERE external_id = @val LIMIT 1`;
      params = { val: value };
      break;
    case "crn":
      sql = `
        SELECT cloc.user_id
        FROM ${TABLES.principal_card_updates} dw5
        JOIN ${TABLES.cms_line_of_credit} cloc ON dw5.f9_dw005_loc_acct = cloc.external_id
        WHERE dw5.f9_dw005_crn = @val
        LIMIT 1`;
      params = { val: value };
      break;
    case "urn":
      sql = `
        SELECT cloc.user_id
        FROM ${TABLES.principal_card_updates} dw5
        JOIN ${TABLES.cms_line_of_credit} cloc ON dw5.f9_dw005_loc_acct = cloc.external_id
        WHERE dw5.px_dw005_urn = @val
        LIMIT 1`;
      params = { val: value };
      break;
    case "anonymous_id":
      sql = `SELECT user_id FROM ${TABLES.rudderstack_users} WHERE anonymous_id = @val LIMIT 1`;
      params = { val: value };
      break;
    case "application_id":
      sql = `SELECT user_id FROM ${TABLES.application_status} WHERE application_id = @val LIMIT 1`;
      params = { val: value };
      break;
    case "phone":
      sql = `SELECT user_id FROM ${TABLES.user} WHERE phone_number = @val LIMIT 1`;
      params = { val: value };
      break;
    case "email":
      sql = `SELECT user_id FROM ${TABLES.user} WHERE LOWER(email) = LOWER(@val) LIMIT 1`;
      params = { val: value };
      break;
    default:
      return null;
  }

  const rows = await runQuery<{ user_id: string }>(sql, params);
  return rows.length > 0 ? rows[0].user_id : null;
}

// ---------------------------------------------------------------------------
// Card type / product type code mappings
// ---------------------------------------------------------------------------

const CARD_TYPE_MAP: Record<string, string> = {
  P: "Physical",
  V: "Virtual",
};

const PRODUCT_TYPE_MAP: Record<string, string> = {
  "10012": "Standard CC (Legacy)",
  "10013": "Standard CC",
  "10014": "RP1 (Prepaid)",
  "10015": "Opening Fee",
};

const CARD_BRAND_MAP: Record<string, string> = {
  VS: "Visa",
  MC: "Mastercard",
};

const ACCOUNT_STATUS_MAP: Record<string, string> = {
  G: "Good / Normal",
  A: "Active",
  B: "Blocked",
  C: "Closed",
  S: "Suspended",
  D: "Delinquent",
  W: "Write-off",
};

const CARD_STATUS_MAP: Record<string, string> = {
  VE: "Verified / Active",
  OR: "Ordered",
  WR: "Waiting Reissue",
  CC: "Cancelled",
  WC: "Waiting Cancellation",
  PC: "Pending Cancellation",
  W: "Waiting",
  WE: "Waiting Emboss",
};

const RESTRICTION_MAP: Record<string, string> = {
  R1: "Temporary Block (R1)",
  R2: "Permanent Block (R2)",
  R4: "Full Block (R4)",
};

// Statuses that indicate a spending block
const SPENDING_BLOCK_CARD_STATUSES = new Set(["CC", "WC", "PC", "W", "WR"]);
const SPENDING_BLOCK_RESTRICTIONS = new Set(["R1", "R2", "R4"]);
const SPENDING_BLOCK_ACCT_STATUSES = new Set(["S", "C", "W"]);

const COLLECTIONS_STATUS_MAP: Record<string, string> = {
  "0": "No collections",
  "1": "Current",
  "2": "In collections",
  "3": "Legal",
  "4": "Write-off",
};

// ---------------------------------------------------------------------------
// User search
// ---------------------------------------------------------------------------

export async function searchUserById(
  userId: string,
): Promise<UserSearchResult | null> {
  // Main query: identity + account snapshot + timeline
  const mainSql = `
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
        dw5.f9_dw005_crn AS prin_crn,
        dw5.px_dw005_urn AS urn,
        dw5.f9_dw005_1st_unblk_all_mtd_tms AS activation_ts,
        dw5.fx_dw005_crd_prd AS card_type,
        dw5.fx_dw005_crd_pgm AS product_type,
        dw5.fx_dw005_crd_brn AS card_brand,
        FORMAT_DATETIME('%Y-%m-%d', dw5.f9_dw005_upd_tms) AS urn_date,
        ROW_NUMBER() OVER (
          PARTITION BY dw5.f9_dw005_loc_acct
          ORDER BY dw5.f9_dw005_upd_tms DESC
        ) AS rn
      FROM ${TABLES.principal_card_updates} dw5
      JOIN loc ON dw5.f9_dw005_loc_acct = loc.loc_acct
    ),

    acct_snapshot AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', dw4.f9_dw004_bus_dt) AS cycle_date,
        FORMAT_DATE('%Y-%m-%d', dw4.f9_dw004_stmt_due_dt) AS next_due_date,
        dw4.f9_dw004_curr_min_rpmt / 100.0 AS current_min_due,
        dw4.f9_dw004_curr_dpd AS current_dpd,
        dw4.fx_dw004_loc_stat AS account_status,
        dw4.fx_dw004_coll_stat_cde AS collections_status,
        dw4.fx_dw004_restrct_stat AS restriction_status,
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

    -- Videocall verified: prefer DW005 f9_dw005_1st_unblk_all_mtd_tms, fallback to Rudderstack event
    videocall_dw AS (
      SELECT
        FORMAT_DATETIME('%Y-%m-%d', DATETIME(dw5.f9_dw005_1st_unblk_all_mtd_tms, 'Asia/Jakarta')) AS videocall_verified_date
      FROM ${TABLES.principal_card_updates} dw5
      JOIN loc ON dw5.f9_dw005_loc_acct = loc.loc_acct
      WHERE dw5.f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL
      ORDER BY dw5.f9_dw005_upd_tms DESC
      LIMIT 1
    ),

    videocall_rs AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(MIN(timestamp), 'Asia/Jakarta')) AS videocall_verified_date
      FROM ${TABLES.milestone_complete}
      WHERE user_id = @userId
        AND application_status IN ('Videocall verified', 'Decision to skip')
    ),

    videocall AS (
      SELECT COALESCE(
        (SELECT videocall_verified_date FROM videocall_dw),
        (SELECT videocall_verified_date FROM videocall_rs)
      ) AS videocall_verified_date
    ),

    card_status_cte AS (
      SELECT
        dw5.fx_dw005_crd_stat AS card_status,
        ROW_NUMBER() OVER (ORDER BY dw5.f9_dw005_upd_tms DESC) AS rn
      FROM ${TABLES.principal_card_updates} dw5
      JOIN loc ON dw5.f9_dw005_loc_acct = loc.loc_acct
      WHERE dw5.fx_dw005_crd_stat IS NOT NULL
    ),

    pin_set AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(MIN(timestamp), 'Asia/Jakarta')) AS pin_set_date
      FROM ${TABLES.milestone_complete}
      WHERE user_id = @userId
        AND application_status = 'PIN set'
    ),

    cma AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(MIN(timestamp), 'Asia/Jakarta')) AS cma_accepted_date,
        MIN(context_app_version) AS cma_app_version
      FROM ${TABLES.milestone_complete}
      WHERE user_id = @userId
        AND application_status = 'Cardholder agreement accepted'
    )

    SELECT
      @userId AS user_id,
      loc.loc_acct,
      loc.credit_limit,
      cl.prin_crn,
      cl.urn AS current_urn,
      cl.urn_date AS current_urn_date,
      cl.card_type,
      cl.product_type AS card_pgm,
      cl.card_brand,
      FORMAT_DATETIME('%Y-%m-%d', cl.activation_ts) AS card_activation_date,
      acct.cycle_date,
      acct.next_due_date,
      acct.current_min_due,
      acct.current_dpd,
      acct.account_status,
      acct.collections_status,
      acct.restriction_status,
      cl_stat.card_status,
      d.decision_date,
      vc.videocall_verified_date,
      ps.pin_set_date,
      cma.cma_accepted_date,
      cma.cma_app_version
    FROM loc
    LEFT JOIN card_latest cl ON cl.rn = 1
    LEFT JOIN acct_snapshot acct ON acct.rn = 1
    LEFT JOIN decision d ON TRUE
    LEFT JOIN videocall vc ON TRUE
    LEFT JOIN pin_set ps ON TRUE
    LEFT JOIN card_status_cte cl_stat ON cl_stat.rn = 1
    LEFT JOIN cma ON TRUE
  `;

  // URN history (previous URNs, excluding the current one)
  const urnHistSql = `
    SELECT DISTINCT
      dw5.px_dw005_urn AS urn,
      FORMAT_DATETIME('%Y-%m-%d', MAX(dw5.f9_dw005_upd_tms)) AS date
    FROM ${TABLES.principal_card_updates} dw5
    JOIN ${TABLES.cms_line_of_credit} cloc
      ON dw5.f9_dw005_loc_acct = cloc.external_id
    WHERE cloc.user_id = @userId
      AND dw5.px_dw005_urn IS NOT NULL
    GROUP BY dw5.px_dw005_urn
    ORDER BY date DESC
    LIMIT 20
  `;

  // Savings account
  const savingsSql = `
    SELECT account_number
    FROM ${TABLES.opened_savings_accounts}
    WHERE user_id = @userId
    LIMIT 1
  `;

  // AWB (most recent) with delivery date from terminal_time
  const awbSql = `
    SELECT
      awb_no,
      status,
      CASE
        WHEN terminal_time IS NOT NULL AND terminal_time > 0
        THEN FORMAT_TIMESTAMP('%Y-%m-%d', TIMESTAMP_MICROS(terminal_time), 'Asia/Jakarta')
        ELSE NULL
      END AS delivery_date
    FROM ${TABLES.card_delivery_tracking}
    WHERE user_id = @userId
    ORDER BY year DESC, month DESC, day DESC, hour DESC
    LIMIT 1
  `;

  // Freshworks open tickets
  const openTicketsSql = `
    SELECT DISTINCT ticket_id, subject, status, priority, category_contact_reason AS category, created_at, resolved_at
    FROM ${TABLES.freshdesk_ticket_summary}
    WHERE user_id = @userId
      AND status NOT IN ('Resolved', 'Closed')
    ORDER BY created_at DESC
    LIMIT 10
  `;

  // Freshworks ticket history (resolved/closed)
  const ticketHistorySql = `
    SELECT DISTINCT ticket_id, subject, status, priority, category_contact_reason AS category, created_at, resolved_at
    FROM ${TABLES.freshdesk_ticket_summary}
    WHERE user_id = @userId
      AND status IN ('Resolved', 'Closed')
    ORDER BY created_at DESC
    LIMIT 20
  `;

  // Repayment history (recent payments with codes/VA references)
  const repaymentSql = `
    SELECT
      TRIM(repayment_code) AS repayment_code,
      vendor,
      repayment_amount AS amount,
      repayment_currency AS currency,
      FORMAT_DATE('%Y-%m-%d', DATE(timestamp, 'Asia/Jakarta')) AS date
    FROM ${TABLES.repayment_completed}
    WHERE user_id = @userId
    ORDER BY timestamp DESC
    LIMIT 12
  `;

  // Run all queries in parallel
  const [mainRows, urnRows, savingsRows, awbRows, openTicketRows, ticketHistoryRows, repaymentRows] = await Promise.all([
    runQuery<Record<string, unknown>>(mainSql, { userId }),
    runQuery<{ urn: string; date: string }>(urnHistSql, { userId }),
    runQuery<{ account_number: string }>(savingsSql, { userId }),
    runQuery<{ awb_no: string; status: string; delivery_date: string | null }>(awbSql, { userId }),
    runQuery<FreshworksTicket>(openTicketsSql, { userId }),
    runQuery<FreshworksTicket>(ticketHistorySql, { userId }),
    runQuery<RepaymentEntry>(repaymentSql, { userId }),
  ]);

  if (mainRows.length === 0) return null;

  const masked = maskRow(mainRows[0]);
  const currentUrn = (masked.current_urn as string) ?? null;

  // Filter out current URN from history
  const previousUrns = urnRows
    .filter((r) => r.urn !== currentUrn)
    .map((r) => ({ urn: r.urn, date: r.date }));

  // Map coded values to human-readable
  const rawCardType = (masked.card_type as string) ?? null;
  const rawCardPgm = (masked.card_pgm as string) ?? null;
  const rawCardBrand = (masked.card_brand as string) ?? null;
  const rawAccountStatus = (masked.account_status as string) ?? null;
  const rawCollStatus = (masked.collections_status as string) ?? null;
  const rawCardStatus = (masked.card_status as string) ?? null;
  const rawRestrictionStatus = (masked.restriction_status as string) ?? null;

  // Determine if spending is blocked
  const hasSpendingBlock =
    (rawCardStatus !== null && SPENDING_BLOCK_CARD_STATUSES.has(rawCardStatus)) ||
    (rawRestrictionStatus !== null && SPENDING_BLOCK_RESTRICTIONS.has(rawRestrictionStatus)) ||
    (rawAccountStatus !== null && SPENDING_BLOCK_ACCT_STATUSES.has(rawAccountStatus));

  return {
    user_id: masked.user_id as string,
    loc_acct: (masked.loc_acct as string) ?? null,
    prin_crn: (masked.prin_crn as string) ?? null,
    current_urn: currentUrn,
    current_urn_date: (masked.current_urn_date as string) ?? null,
    card_type: rawCardType ? (CARD_TYPE_MAP[rawCardType] ?? rawCardType) : null,
    card_pgm: rawCardPgm,
    product_type: rawCardPgm ? (PRODUCT_TYPE_MAP[rawCardPgm] ?? rawCardPgm) : null,
    card_brand: rawCardBrand ? (CARD_BRAND_MAP[rawCardBrand] ?? rawCardBrand) : null,
    credit_limit: (masked.credit_limit as number) ?? null,
    previous_urns: previousUrns,
    decision_date: (masked.decision_date as string) ?? null,
    pin_set_date: (masked.pin_set_date as string) ?? null,
    videocall_verified_date: (masked.videocall_verified_date as string) ?? null,
    card_activation_date: (masked.card_activation_date as string) ?? null,
    cma_accepted_date: (masked.cma_accepted_date as string) ?? null,
    cma_app_version: (masked.cma_app_version as string) ?? null,
    account_status: rawAccountStatus ? (ACCOUNT_STATUS_MAP[rawAccountStatus] ?? rawAccountStatus) : null,
    cycle_date: (masked.cycle_date as string) ?? null,
    next_due_date: (masked.next_due_date as string) ?? null,
    current_min_due: (masked.current_min_due as number) ?? null,
    current_dpd: (masked.current_dpd as number) ?? null,
    collections_status: rawCollStatus ? (COLLECTIONS_STATUS_MAP[rawCollStatus] ?? `Code ${rawCollStatus}`) : null,
    savings_account_number: savingsRows.length > 0 ? savingsRows[0].account_number : null,
    awb_number: awbRows.length > 0 ? awbRows[0].awb_no : null,
    awb_status: awbRows.length > 0 ? awbRows[0].status : null,
    delivery_date: awbRows.length > 0 ? awbRows[0].delivery_date ?? null : null,
    card_status: rawCardStatus ? (CARD_STATUS_MAP[rawCardStatus] ?? rawCardStatus) : null,
    restriction_status: rawRestrictionStatus ? (RESTRICTION_MAP[rawRestrictionStatus] ?? rawRestrictionStatus) : null,
    has_spending_block: hasSpendingBlock,
    repayment_history: repaymentRows,
    open_tickets: openTicketRows,
    ticket_history: ticketHistoryRows,
  };
}
