import { BigQuery } from "@google-cloud/bigquery";

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

export async function runQuery<T = Record<string, unknown>>(
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

  // Bridge table
  cms_line_of_credit: "`storage-58f5a02c.mart_growthbook.cms_line_of_credit`",

  // Rudderstack event tables
  decision_completed: "`storage-58f5a02c.refined_rudderstack.decision_completed`",
  milestone_complete: "`storage-58f5a02c.refined_rudderstack.milestone_complete`",
  repayment_completed: "`storage-58f5a02c.refined_rudderstack.repayment_completed`",
  rudderstack_users: "`storage-58f5a02c.refined_rudderstack.users`",

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
} as const;
