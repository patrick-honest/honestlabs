/**
 * GET /api/search?field=<field>&query=<value>
 * Also supports legacy: ?userId=<uuid>
 */

import { runQuery, TABLES } from "../_shared/bigquery-client";
import { getCached, setCached } from "../_shared/cache";
import type { Env } from "../_shared/bigquery-auth";

// ---------------------------------------------------------------------------
// PII masking (ported from src/lib/pii.ts)
// ---------------------------------------------------------------------------

const PII_FIELDS = new Set([
  "full_name", "first_name", "middle_name", "last_name", "card_holder_name",
  "fx_dw001_name", "fx_dw001_emb_name", "fx_dw002_name",
  "phone_number", "mobile_phone", "landline_phone",
  "fx_dw001_hp", "fx_dw001_bil_tel", "fx_dw002_hp", "fx_dw002_hme_tel", "fx_dw002_corsp_tel",
  "context_traits_phone_number",
  "email", "email_id", "fx_dw001_email_addr", "fx_dw002_email_addr",
  "gov_id", "id_document_number", "fx_dw001_new_id", "fx_dw002_new_id",
  "fx_dw001_bil_addr_1", "fx_dw001_bil_addr_2", "fx_dw001_bil_addr_3", "fx_dw001_bil_addr_4",
  "fx_dw002_hme_addr_1", "fx_dw002_hme_addr_2", "fx_dw002_hme_addr_3", "fx_dw002_hme_addr_4",
  "fx_dw002_corsp_addr_1", "fx_dw002_corsp_addr_2", "fx_dw002_corsp_addr_3", "fx_dw002_corsp_addr_4",
  "date_of_birth", "f9_dw001_dob", "f9_dw002_dob", "dob",
  "fx_dw002_gendr", "context_traits_gender", "fx_dw002_marr_stat", "mother_maiden_name",
  "fx_dw001_bil_zip", "fx_dw002_hme_zip", "fx_dw002_corsp_zip", "fx_dw001_pob", "fx_dw002_pob",
]);

function maskValue(fieldName: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const key = fieldName.toLowerCase();
  if (!PII_FIELDS.has(key)) return value;
  const str = String(value);
  if (str.length === 0) return value;
  if (key.includes("name") || key === "mother_maiden_name") return str[0] + "*".repeat(Math.min(str.length - 1, 8));
  if (key.includes("phone") || key.includes("_hp") || key.includes("_tel")) return str.length <= 4 ? "****" : "*".repeat(str.length - 4) + str.slice(-4);
  if (key.includes("email")) { const i = str.indexOf("@"); return i > 0 ? str[0] + "***" + str.slice(i) : str[0] + "***"; }
  if (key.includes("gov_id") || key.includes("new_id") || key.includes("document_number")) return str.length <= 6 ? "****" : str.slice(0, 4) + "*".repeat(str.length - 6) + str.slice(-2);
  return "[REDACTED]";
}

function maskRow(row: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) masked[key] = maskValue(key, value);
  return masked;
}

// ---------------------------------------------------------------------------
// Code mappings
// ---------------------------------------------------------------------------

const RP1_PROGRAMS = new Set(["10014", "00014"]);
const REG_FEE_PROGRAMS = new Set(["10015", "00015"]);
function resolveProductType(decisionType: string | null, cardPgm: string | null): string | null {
  if (decisionType) return decisionType;
  if (!cardPgm) return null;
  if (RP1_PROGRAMS.has(cardPgm)) return "RP1";
  if (REG_FEE_PROGRAMS.has(cardPgm)) return "Registration Fee";
  return "Regular";
}

const CARD_TYPE_MAP: Record<string, string> = { P: "Physical", V: "Virtual" };
const CARD_BRAND_MAP: Record<string, string> = { VS: "Visa", MC: "Mastercard" };
const ACCOUNT_STATUS_MAP: Record<string, string> = { G: "Good / Normal", A: "Active", B: "Blocked", C: "Closed", S: "Suspended", D: "Delinquent", W: "Write-off" };
const CARD_STATUS_MAP: Record<string, string> = { VE: "Verified / Active", OR: "Ordered", WR: "Waiting Reissue", CC: "Cancelled", WC: "Waiting Cancellation", PC: "Pending Cancellation", W: "Waiting", WE: "Waiting Emboss" };
const RESTRICTION_MAP: Record<string, string> = { R1: "Temporary Block (R1)", R2: "Permanent Block (R2)", R4: "Full Block (R4)" };
const COLLECTIONS_STATUS_MAP: Record<string, string> = { "0": "No collections", "1": "Current", "2": "In collections", "3": "Legal", "4": "Write-off" };
const SPENDING_BLOCK_CARD_STATUSES = new Set(["CC", "WC", "PC", "W", "WR"]);
const SPENDING_BLOCK_RESTRICTIONS = new Set(["R1", "R2", "R4"]);
const SPENDING_BLOCK_ACCT_STATUSES = new Set(["S", "C", "W"]);

const VALID_FIELDS = new Set(["user_id", "loc", "crn", "urn", "anonymous_id", "application_id", "phone", "email"]);

// ---------------------------------------------------------------------------
// Resolve alternate identifiers to user_id
// ---------------------------------------------------------------------------

async function resolveToUserId(field: string, value: string, env: Env): Promise<string | null> {
  let sql: string;
  switch (field) {
    case "loc": sql = `SELECT user_id FROM ${TABLES.cms_line_of_credit} WHERE external_id = @val LIMIT 1`; break;
    case "crn": sql = `SELECT cloc.user_id FROM ${TABLES.principal_card_updates} dw5 JOIN ${TABLES.cms_line_of_credit} cloc ON dw5.f9_dw005_loc_acct = cloc.external_id WHERE dw5.f9_dw005_crn = @val LIMIT 1`; break;
    case "urn": sql = `SELECT cloc.user_id FROM ${TABLES.principal_card_updates} dw5 JOIN ${TABLES.cms_line_of_credit} cloc ON dw5.f9_dw005_loc_acct = cloc.external_id WHERE dw5.px_dw005_urn = @val LIMIT 1`; break;
    case "anonymous_id": sql = `SELECT user_id FROM ${TABLES.rudderstack_users} WHERE anonymous_id = @val LIMIT 1`; break;
    case "application_id": sql = `SELECT user_id FROM ${TABLES.application_status} WHERE application_id = @val LIMIT 1`; break;
    case "phone": sql = `SELECT user_id FROM ${TABLES.user} WHERE phone_number = @val LIMIT 1`; break;
    case "email": sql = `SELECT user_id FROM ${TABLES.user} WHERE LOWER(email) = LOWER(@val) LIMIT 1`; break;
    default: return null;
  }
  const rows = await runQuery<{ user_id: string }>(sql, { val: value }, env);
  return rows.length > 0 ? rows[0].user_id : null;
}

// ---------------------------------------------------------------------------
// Search user by ID
// ---------------------------------------------------------------------------

async function searchUserById(userId: string, env: Env) {
  const mainSql = `
    WITH loc AS (
      SELECT user_id, external_id AS loc_acct, status
      FROM ${TABLES.cms_line_of_credit} WHERE user_id = @userId LIMIT 1
    ),
    card_latest AS (
      SELECT dw5.f9_dw005_crn AS prin_crn, dw5.px_dw005_urn AS urn,
        dw5.f9_dw005_1st_unblk_all_mtd_tms AS activation_ts,
        dw5.fx_dw005_crd_prd AS card_type, dw5.fx_dw005_crd_pgm AS product_type,
        dw5.fx_dw005_crd_brn AS card_brand,
        FORMAT_DATETIME('%Y-%m-%d', dw5.f9_dw005_upd_tms) AS urn_date,
        ROW_NUMBER() OVER (PARTITION BY dw5.f9_dw005_loc_acct ORDER BY dw5.f9_dw005_upd_tms DESC) AS rn
      FROM ${TABLES.principal_card_updates} dw5 JOIN loc ON dw5.f9_dw005_loc_acct = loc.loc_acct
    ),
    acct_snapshot AS (
      SELECT FORMAT_DATE('%Y-%m-%d', dw4.f9_dw004_bus_dt) AS cycle_date,
        FORMAT_DATE('%Y-%m-%d', dw4.f9_dw004_stmt_due_dt) AS next_due_date,
        dw4.f9_dw004_curr_min_rpmt / 100.0 AS current_min_due,
        dw4.f9_dw004_curr_dpd AS current_dpd,
        dw4.f9_dw004_loc_lmt AS credit_limit,
        dw4.fx_dw004_loc_stat AS account_status,
        dw4.fx_dw004_coll_stat_cde AS collections_status,
        dw4.fx_dw004_restrct_stat AS restriction_status,
        ROW_NUMBER() OVER (ORDER BY dw4.f9_dw004_bus_dt DESC) AS rn
      FROM ${TABLES.financial_account_updates} dw4 JOIN loc ON dw4.p9_dw004_loc_acct = loc.loc_acct
    ),
    decision AS (
      SELECT FORMAT_DATE('%Y-%m-%d', DATE(MIN(timestamp), 'Asia/Jakarta')) AS decision_date,
        ARRAY_AGG(credit_risk_category ORDER BY timestamp DESC LIMIT 1)[OFFSET(0)] AS credit_risk_category,
        CASE WHEN COUNT(*) = 0 THEN NULL
          WHEN LOGICAL_OR(CAST(is_prepaid_card_applicable AS BOOL)) THEN 'RP1'
          WHEN LOGICAL_OR(CAST(is_account_opening_fee_applicable AS BOOL)) THEN 'Registration Fee'
          ELSE 'Regular' END AS decision_product_type
      FROM ${TABLES.decision_completed} WHERE user_id = @userId
    ),
    videocall_dw AS (
      SELECT FORMAT_DATETIME('%Y-%m-%d', DATETIME(dw5.f9_dw005_1st_unblk_all_mtd_tms, 'Asia/Jakarta')) AS videocall_verified_date
      FROM ${TABLES.principal_card_updates} dw5 JOIN loc ON dw5.f9_dw005_loc_acct = loc.loc_acct
      WHERE dw5.f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL ORDER BY dw5.f9_dw005_upd_tms DESC LIMIT 1
    ),
    videocall_rs AS (
      SELECT FORMAT_DATE('%Y-%m-%d', DATE(MIN(timestamp), 'Asia/Jakarta')) AS videocall_verified_date
      FROM ${TABLES.milestone_complete} WHERE user_id = @userId AND application_status IN ('Videocall verified', 'Decision to skip')
    ),
    videocall AS (
      SELECT COALESCE((SELECT videocall_verified_date FROM videocall_dw), (SELECT videocall_verified_date FROM videocall_rs)) AS videocall_verified_date
    ),
    card_status_cte AS (
      SELECT dw5.fx_dw005_crd_stat AS card_status, ROW_NUMBER() OVER (ORDER BY dw5.f9_dw005_upd_tms DESC) AS rn
      FROM ${TABLES.principal_card_updates} dw5 JOIN loc ON dw5.f9_dw005_loc_acct = loc.loc_acct WHERE dw5.fx_dw005_crd_stat IS NOT NULL
    ),
    pin_set AS (
      SELECT FORMAT_DATE('%Y-%m-%d', DATE(MIN(timestamp), 'Asia/Jakarta')) AS pin_set_date
      FROM ${TABLES.milestone_complete} WHERE user_id = @userId AND application_status = 'PIN set'
    ),
    cma AS (
      SELECT FORMAT_DATE('%Y-%m-%d', DATE(MIN(timestamp), 'Asia/Jakarta')) AS cma_accepted_date, MIN(context_app_version) AS cma_app_version
      FROM ${TABLES.milestone_complete} WHERE user_id = @userId AND application_status = 'Cardholder agreement accepted'
    )
    SELECT @userId AS user_id, loc.loc_acct, acct.credit_limit, cl.prin_crn, cl.urn AS current_urn,
      cl.urn_date AS current_urn_date, cl.card_type, cl.product_type AS card_pgm, cl.card_brand,
      FORMAT_DATETIME('%Y-%m-%d', cl.activation_ts) AS card_activation_date,
      acct.cycle_date, acct.next_due_date, acct.current_min_due, acct.current_dpd,
      acct.account_status, acct.collections_status, acct.restriction_status,
      cl_stat.card_status, d.decision_date, d.credit_risk_category, d.decision_product_type,
      vc.videocall_verified_date, ps.pin_set_date, cma.cma_accepted_date, cma.cma_app_version
    FROM loc
    LEFT JOIN card_latest cl ON cl.rn = 1
    LEFT JOIN acct_snapshot acct ON acct.rn = 1
    LEFT JOIN decision d ON TRUE
    LEFT JOIN videocall vc ON TRUE
    LEFT JOIN pin_set ps ON TRUE
    LEFT JOIN card_status_cte cl_stat ON cl_stat.rn = 1
    LEFT JOIN cma ON TRUE
  `;

  const urnHistSql = `SELECT DISTINCT dw5.px_dw005_urn AS urn, FORMAT_DATETIME('%Y-%m-%d', MAX(dw5.f9_dw005_upd_tms)) AS date
    FROM ${TABLES.principal_card_updates} dw5 JOIN ${TABLES.cms_line_of_credit} cloc ON dw5.f9_dw005_loc_acct = cloc.external_id
    WHERE cloc.user_id = @userId AND dw5.px_dw005_urn IS NOT NULL GROUP BY dw5.px_dw005_urn ORDER BY date DESC LIMIT 20`;

  const savingsSql = `SELECT account_number FROM ${TABLES.opened_savings_accounts} WHERE user_id = @userId LIMIT 1`;

  const awbSql = `SELECT awb_no, status,
    CASE WHEN terminal_time IS NOT NULL AND terminal_time > 0 THEN FORMAT_TIMESTAMP('%Y-%m-%d', TIMESTAMP_MICROS(terminal_time), 'Asia/Jakarta') ELSE NULL END AS delivery_date
    FROM ${TABLES.card_delivery_tracking} WHERE user_id = @userId ORDER BY year DESC, month DESC, day DESC, hour DESC LIMIT 1`;

  const openTicketsSql = `SELECT DISTINCT ticket_id, subject, status, priority, category_contact_reason AS category, created_at, resolved_at
    FROM ${TABLES.freshdesk_ticket_summary} WHERE user_id = @userId AND status NOT IN ('Resolved', 'Closed') ORDER BY created_at DESC LIMIT 10`;

  const ticketHistorySql = `SELECT DISTINCT ticket_id, subject, status, priority, category_contact_reason AS category, created_at, resolved_at
    FROM ${TABLES.freshdesk_ticket_summary} WHERE user_id = @userId AND status IN ('Resolved', 'Closed') ORDER BY created_at DESC LIMIT 20`;

  const repaymentSql = `SELECT TRIM(repayment_code) AS repayment_code, vendor, repayment_amount AS amount, repayment_currency AS currency,
    FORMAT_DATE('%Y-%m-%d', DATE(timestamp, 'Asia/Jakarta')) AS date
    FROM ${TABLES.repayment_completed} WHERE user_id = @userId ORDER BY timestamp DESC LIMIT 12`;

  const [mainRows, urnRows, savingsRows, awbRows, openTicketRows, ticketHistoryRows, repaymentRows] = await Promise.all([
    runQuery<Record<string, unknown>>(mainSql, { userId }, env),
    runQuery<{ urn: string; date: string }>(urnHistSql, { userId }, env),
    runQuery<{ account_number: string }>(savingsSql, { userId }, env),
    runQuery<{ awb_no: string; status: string; delivery_date: string | null }>(awbSql, { userId }, env),
    runQuery<Record<string, unknown>>(openTicketsSql, { userId }, env),
    runQuery<Record<string, unknown>>(ticketHistorySql, { userId }, env),
    runQuery<Record<string, unknown>>(repaymentSql, { userId }, env),
  ]);

  if (mainRows.length === 0) return null;

  const masked = maskRow(mainRows[0]);
  const currentUrn = (masked.current_urn as string) ?? null;
  const previousUrns = urnRows.filter(r => r.urn !== currentUrn).map(r => ({ urn: r.urn, date: r.date }));

  const rawCardType = (masked.card_type as string) ?? null;
  const rawCardPgm = (masked.card_pgm as string) ?? null;
  const rawCardBrand = (masked.card_brand as string) ?? null;
  const rawAccountStatus = (masked.account_status as string) ?? null;
  const rawCollStatus = (masked.collections_status as string) ?? null;
  const rawCardStatus = (masked.card_status as string) ?? null;
  const rawRestrictionStatus = (masked.restriction_status as string) ?? null;

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
    product_type: resolveProductType((masked.decision_product_type as string) ?? null, rawCardPgm),
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
    credit_risk_category: (masked.credit_risk_category as string) ?? null,
    savings_account_number: savingsRows.length > 0 ? savingsRows[0].account_number : null,
    awb_number: awbRows.length > 0 ? (awbRows[0] as Record<string, unknown>).awb_no : null,
    awb_status: awbRows.length > 0 ? (awbRows[0] as Record<string, unknown>).status : null,
    delivery_date: awbRows.length > 0 ? (awbRows[0] as Record<string, unknown>).delivery_date ?? null : null,
    card_status: rawCardStatus ? (CARD_STATUS_MAP[rawCardStatus] ?? rawCardStatus) : null,
    restriction_status: rawRestrictionStatus ? (RESTRICTION_MAP[rawRestrictionStatus] ?? rawRestrictionStatus) : null,
    has_spending_block: hasSpendingBlock,
    repayment_history: repaymentRows,
    open_tickets: openTicketRows,
    ticket_history: ticketHistoryRows,
  };
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  let field = url.searchParams.get("field") || "user_id";
  let query = url.searchParams.get("query") || url.searchParams.get("userId") || "";

  if (!query || query.trim().length === 0) {
    return new Response(JSON.stringify({ error: "query parameter is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  query = query.trim();
  field = field.trim().toLowerCase();

  if (!VALID_FIELDS.has(field)) {
    return new Response(JSON.stringify({ error: `Invalid field: ${field}` }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (field === "user_id" && !uuidRegex.test(query)) {
    return new Response(JSON.stringify({ error: "user_id must be a valid UUID" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    const cacheKeyStr = `search:${field}:${query}`;
    const cached = await getCached<{ user: unknown }>(cacheKeyStr, env.KPI_CACHE);
    if (cached && cached.fresh) {
      return new Response(JSON.stringify({ user: cached.data.user, asOf: new Date().toISOString(), cached: true }), {
        headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=120", "X-Cache": "HIT" },
      });
    }

    let userId: string;
    if (field === "user_id") {
      userId = query;
    } else {
      const resolved = await resolveToUserId(field, query, env);
      if (!resolved) {
        return new Response(JSON.stringify({ error: "No user found for the given identifier", field, query }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      userId = resolved;
    }

    const result = await searchUserById(userId, env);
    if (!result) {
      return new Response(JSON.stringify({ error: "User not found", userId }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    await setCached(cacheKeyStr, { user: result }, env.KPI_CACHE, 7200);

    return new Response(JSON.stringify({ user: result, asOf: new Date().toISOString(), cached: false }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=120", "X-Cache": "MISS" },
    });
  } catch (err) {
    console.error("[GET /api/search]", err);
    return new Response(JSON.stringify({ error: "Failed to search user", details: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
