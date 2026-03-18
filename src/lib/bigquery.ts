import { BigQuery } from "@google-cloud/bigquery";
import crypto from "crypto";

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID || "storage-58f5a02c";

let _client: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (!_client) {
    _client = new BigQuery({
      projectId: PROJECT_ID,
      location: "asia-southeast2",
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// In-memory query cache — prevents duplicate BigQuery hits for the same SQL
// within the server process. Each entry has a 10-minute TTL.
// Also deduplicates concurrent identical queries (request coalescing).
// ---------------------------------------------------------------------------

interface MemCacheEntry {
  data: unknown[];
  expiresAt: number;
}

const MEM_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MEM_CACHE_MAX_ENTRIES = 200;

const _memCache = new Map<string, MemCacheEntry>();
const _inflight = new Map<string, Promise<unknown[]>>();

// Query execution stats for monitoring
let _queryStats = { hits: 0, misses: 0, coalesced: 0, totalBytesAvoided: 0 };

function makeQueryKey(sql: string, params?: Record<string, unknown>): string {
  const hash = crypto
    .createHash("sha256")
    .update(sql + (params ? JSON.stringify(params) : ""))
    .digest("hex")
    .slice(0, 16);
  return hash;
}

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of _memCache) {
    if (entry.expiresAt < now) _memCache.delete(key);
  }
  // If still over limit, evict oldest entries
  if (_memCache.size > MEM_CACHE_MAX_ENTRIES) {
    const entries = [..._memCache.entries()].sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt,
    );
    const toRemove = entries.slice(0, entries.length - MEM_CACHE_MAX_ENTRIES);
    for (const [key] of toRemove) _memCache.delete(key);
  }
}

export async function runQuery<T = Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const key = makeQueryKey(sql, params);

  // 1. Check in-memory cache
  const cached = _memCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    _queryStats.hits++;
    return cached.data as T[];
  }

  // 2. Check if same query is already in-flight (request coalescing)
  const inflight = _inflight.get(key);
  if (inflight) {
    _queryStats.coalesced++;
    return inflight as Promise<T[]>;
  }

  // 3. Execute query and cache the result
  _queryStats.misses++;
  const promise = executeQuery<T>(sql, params).then((rows) => {
    _memCache.set(key, { data: rows, expiresAt: Date.now() + MEM_CACHE_TTL_MS });
    _inflight.delete(key);
    evictExpired();
    return rows;
  }).catch((err) => {
    _inflight.delete(key);
    throw err;
  });

  _inflight.set(key, promise as Promise<unknown[]>);
  return promise;
}

async function executeQuery<T = Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const client = getBigQueryClient();
  const options: { query: string; params?: Record<string, unknown>; location: string } = {
    query: sql,
    location: "asia-southeast2",
  };
  if (params) {
    options.params = params;
  }
  const [rows] = await client.query(options);
  return rows as T[];
}

/**
 * Get query cache statistics for monitoring.
 */
export function getQueryStats() {
  return {
    ..._queryStats,
    memoryCacheSize: _memCache.size,
    inflightQueries: _inflight.size,
  };
}

/**
 * Clear the in-memory cache (useful after cron refresh).
 */
export function clearMemoryCache(): void {
  _memCache.clear();
  _inflight.clear();
}

export async function estimateQueryCost(sql: string): Promise<{ bytesProcessed: number; estimatedCostUsd: number }> {
  const client = getBigQueryClient();
  const [job] = await client.createQueryJob({
    query: sql,
    location: "asia-southeast2",
    dryRun: true,
  });
  const bytes = Number(job.metadata?.statistics?.totalBytesProcessed || 0);
  // BigQuery pricing: $6.25 per TB scanned (on-demand)
  const costUsd = (bytes / 1_099_511_627_776) * 6.25;
  return { bytesProcessed: bytes, estimatedCostUsd: costUsd };
}

// Common table references
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
} as const;
