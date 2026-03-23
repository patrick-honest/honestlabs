/**
 * BigQuery REST API client for Cloudflare Workers.
 * Replaces the @google-cloud/bigquery SDK which requires Node.js.
 */

import { getAccessToken, type Env } from "./bigquery-auth";

const PROJECT_ID = "storage-58f5a02c";
const LOCATION = "asia-southeast2";
const BQ_API = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}`;

// ---------------------------------------------------------------------------
// Table references (copied from src/lib/bigquery.ts)
// ---------------------------------------------------------------------------

export const TABLES = {
  // Finexus DW tables
  financial_account_updates: "`storage-58f5a02c.mart_finexus.financial_account_updates`",
  posted_transaction: "`storage-58f5a02c.mart_finexus.posted_transaction`",
  authorized_transaction: "`storage-58f5a02c.mart_finexus.authorized_transaction`",
  principal_card_updates: "`storage-58f5a02c.mart_finexus.principal_card_updates`",
  new_card_application: "`storage-58f5a02c.mart_finexus.new_card_application`",
  card_history: "`storage-58f5a02c.mart_finexus.card_history`",
  financial_statement_updates: "`storage-58f5a02c.mart_finexus.financial_statement_updates`",
  incoming_interchange: "`storage-58f5a02c.mart_finexus.incoming_interchange_posting_journal`",
  points_summary: "`storage-58f5a02c.mart_finexus.points_summary`",
  points_details: "`storage-58f5a02c.mart_finexus.points_details`",
  card_memo_message: "`storage-58f5a02c.mart_finexus.card_memo_message`",
  safe2pay_alert: "`storage-58f5a02c.mart_finexus.safe2pay_alert`",
  safe2pay_txn_error: "`storage-58f5a02c.mart_finexus.safe2pay_transaction_error_log`",
  card_restructure: "`storage-58f5a02c.mart_finexus.card_restructure`",
  user_profile_updates: "`storage-58f5a02c.mart_finexus.user_profile_updates`",

  // Bridge table
  cms_line_of_credit: "`storage-58f5a02c.mart_growthbook.cms_line_of_credit`",

  // Rudderstack event tables
  decision_completed: "`storage-58f5a02c.refined_rudderstack.decision_completed`",
  milestone_complete: "`storage-58f5a02c.refined_rudderstack.milestone_complete`",
  repayment_completed: "`storage-58f5a02c.refined_rudderstack.repayment_completed`",
  rudderstack_users: "`storage-58f5a02c.refined_rudderstack.users`",
  transaction_authorized: "`storage-58f5a02c.refined_rudderstack.transaction_authorized`",
  experiment_viewed: "`storage-58f5a02c.refined_rudderstack.experiment_viewed`",
  referral_application_started: "`storage-58f5a02c.refined_rudderstack.referral_application_started`",
  referral_approved: "`storage-58f5a02c.refined_rudderstack.referral_approved`",
  credit_line_increased: "`storage-58f5a02c.refined_rudderstack.credit_line_increased`",
  tracks: "`storage-58f5a02c.refined_rudderstack.tracks`",
  screens: "`storage-58f5a02c.refined_rudderstack.screens`",
  snackbar_shown: "`storage-58f5a02c.refined_rudderstack.snackbar_shown`",
  auto_activation_enabled: "`storage-58f5a02c.refined_rudderstack.auto_activation_enabled`",

  // Core API tables
  application_status: "`storage-58f5a02c.refined_core_api.application_status`",
  application_status_lead: "`storage-58f5a02c.refined_core_api.application_status_lead`",
  lead: "`storage-58f5a02c.refined_core_api.lead`",
  user: "`storage-58f5a02c.refined_core_api.user`",

  // KYC
  kyc_detail: "`storage-58f5a02c.refined_kyc_details_service.kyc_detail`",

  // Contract
  customer_contract: "`storage-58f5a02c.refined_contract_generation_service.customer_contract`",
  esign_submitted: "`storage-58f5a02c.refined_core_api.refined_core_api_acquisition_esign_event_submitted`",

  // Device data
  device_events: "`storage-58f5a02c.refined_device_data.events_v2`",

  // Collections
  regular_activity: "`storage-58f5a02c.mart_collections.regular_activity`",

  // Freshworks
  freshdesk_ticket_summary: "`storage-58f5a02c.mart_freshworks.freshdesk_ticket_summary`",

  // Savings
  opened_savings_accounts: "`storage-58f5a02c.refined_savings_account_service.opened_savings_accounts`",

  // Card delivery (AWB)
  card_delivery_tracking: "`storage-58f5a02c.raw_raw_card_delivery_tracking_job.ss_card_delivery_anteraja_tracking_notification`",

  // QRIS experiment
  qris_rollout: "`storage-58f5a02c.sandbox_risk.sample_qris_rollout_test_10k_202601`",
} as const;

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------

interface BqQueryParameter {
  name: string;
  parameterType: { type: string };
  parameterValue: { value: string };
}

interface BqField {
  name: string;
  type: string;
}

interface BqRow {
  f: Array<{ v: string | null }>;
}

interface BqResponse {
  jobComplete: boolean;
  jobReference?: { jobId: string };
  schema?: { fields: BqField[] };
  rows?: BqRow[];
  totalRows?: string;
  errors?: Array<{ message: string }>;
}

function buildQueryParams(
  params?: Record<string, string>,
): BqQueryParameter[] {
  if (!params) return [];
  return Object.entries(params).map(([name, value]) => ({
    name,
    parameterType: { type: "STRING" },
    parameterValue: { value },
  }));
}

function castValue(value: string | null, type: string): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case "INTEGER":
    case "INT64":
      return parseInt(value, 10);
    case "FLOAT":
    case "FLOAT64":
    case "NUMERIC":
    case "BIGNUMERIC":
      return parseFloat(value);
    case "BOOLEAN":
    case "BOOL":
      return value === "true";
    default:
      return value;
  }
}

function mapRows<T>(fields: BqField[], rows: BqRow[]): T[] {
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    row.f.forEach((cell, i) => {
      obj[fields[i].name] = castValue(cell.v, fields[i].type);
    });
    return obj as T;
  });
}

export async function runQuery<T = Record<string, unknown>>(
  sql: string,
  params: Record<string, string> | undefined,
  env: Env,
): Promise<T[]> {
  const token = await getAccessToken(env);

  const body = {
    query: sql,
    useLegacySql: false,
    location: LOCATION,
    parameterMode: "NAMED",
    queryParameters: buildQueryParams(params),
    maxResults: 10000,
    timeoutMs: 60000,
  };

  const res = await fetch(`${BQ_API}/queries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BigQuery query failed (${res.status}): ${text}`);
  }

  let data: BqResponse = await res.json();

  // Poll for completion if needed
  if (!data.jobComplete && data.jobReference?.jobId) {
    const jobId = data.jobReference.jobId;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(
        `${BQ_API}/queries/${jobId}?location=${LOCATION}&timeoutMs=30000`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!pollRes.ok) throw new Error(`BigQuery poll failed: ${pollRes.status}`);
      data = await pollRes.json();
      if (data.jobComplete) break;
    }
    if (!data.jobComplete) {
      throw new Error("BigQuery query timed out after 60s of polling");
    }
  }

  if (data.errors?.length) {
    throw new Error(`BigQuery errors: ${data.errors.map((e) => e.message).join("; ")}`);
  }

  if (!data.schema?.fields || !data.rows) return [];
  return mapRows<T>(data.schema.fields, data.rows);
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function toSqlDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Get the last full ISO week (Mon-Sun) before today */
export function getLastFullWeek(): { start: Date; end: Date } {
  const now = new Date();
  // Find last Sunday
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const lastSunday = new Date(now);
  lastSunday.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 7 : dayOfWeek));
  lastSunday.setUTCHours(0, 0, 0, 0);

  const lastMonday = new Date(lastSunday);
  lastMonday.setUTCDate(lastSunday.getUTCDate() - 6);

  return { start: lastMonday, end: lastSunday };
}

/** Get the week before the given start date */
export function getPriorWeek(start: Date): { start: Date; end: Date } {
  const priorEnd = new Date(start);
  priorEnd.setUTCDate(start.getUTCDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setUTCDate(priorEnd.getUTCDate() - 6);
  return { start: priorStart, end: priorEnd };
}

/**
 * Get a wider date range for queries that need multiple weeks of data.
 * Goes back N weeks from the end date.
 */
export function getExtendedRange(
  end: Date,
  weeksBack: number,
): { start: Date; end: Date } {
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - weeksBack * 7);
  return { start, end };
}
