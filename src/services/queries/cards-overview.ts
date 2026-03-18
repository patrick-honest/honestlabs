import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardStatusRow {
  card_status: string;
  brand: string;
  accounts: number;
}

export interface CardBrandRow {
  brand: string;
  accounts: number;
}

export interface CardProgramRow {
  card_pgm: string;
  brand: string;
  accounts: number;
}

export interface AutoActivationRow {
  count: number;
}

export interface VerificationRow {
  reason: string;
  users: number;
}

export interface ProductTypeRow {
  product_type: string;
  users: number;
}

// ---------------------------------------------------------------------------
// 1. Card Status Distribution (latest DW005 snapshot, last 7 days)
// ---------------------------------------------------------------------------

export async function getCardStatusDistribution(): Promise<CardStatusRow[]> {
  const sql = `
    SELECT
      COALESCE(fx_dw005_crd_stat, 'Active') AS card_status,
      fx_dw005_crd_brn AS brand,
      COUNT(DISTINCT f9_dw005_loc_acct) AS accounts
    FROM ${TABLES.principal_card_updates}
    WHERE f9_dw005_upd_tms >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
    GROUP BY 1, 2
    ORDER BY accounts DESC
  `;

  return runQuery<CardStatusRow>(sql);
}

// ---------------------------------------------------------------------------
// 2. Card Brand Split (MC vs VS)
// ---------------------------------------------------------------------------

export async function getCardBrandSplit(): Promise<CardBrandRow[]> {
  const sql = `
    SELECT
      fx_dw005_crd_brn AS brand,
      COUNT(DISTINCT f9_dw005_loc_acct) AS accounts
    FROM ${TABLES.principal_card_updates}
    WHERE f9_dw005_upd_tms >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
    GROUP BY brand
  `;

  return runQuery<CardBrandRow>(sql);
}

// ---------------------------------------------------------------------------
// 3. Card Program Distribution
// ---------------------------------------------------------------------------

export async function getCardProgramDistribution(): Promise<CardProgramRow[]> {
  const sql = `
    SELECT
      fx_dw005_crd_pgm AS card_pgm,
      fx_dw005_crd_brn AS brand,
      COUNT(DISTINCT f9_dw005_loc_acct) AS accounts
    FROM ${TABLES.principal_card_updates}
    WHERE f9_dw005_upd_tms >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
    GROUP BY 1, 2
    ORDER BY accounts DESC
  `;

  return runQuery<CardProgramRow>(sql);
}

// ---------------------------------------------------------------------------
// 4. Auto-Activation Count
// ---------------------------------------------------------------------------

export async function getAutoActivationCount(): Promise<number> {
  const sql = `
    SELECT COUNT(DISTINCT user_id) AS count
    FROM ${TABLES.auto_activation_enabled}
  `;

  const rows = await runQuery<AutoActivationRow>(sql);
  return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// 5. Verification Split (VIDEO_VERIFIED vs DECISION_TO_SKIP)
// ---------------------------------------------------------------------------

export async function getVerificationSplit(
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
  `;

  return runQuery<VerificationRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}

// ---------------------------------------------------------------------------
// 6. Product Type Split (from decision_completed)
// ---------------------------------------------------------------------------

export async function getProductTypeSplit(
  startDate: Date,
  endDate: Date,
): Promise<ProductTypeRow[]> {
  const sql = `
    SELECT
      CASE
        WHEN is_prepaid_card_applicable = TRUE THEN 'RP1'
        WHEN is_account_opening_fee_applicable = TRUE THEN 'AOF'
        WHEN is_salvage_user = TRUE THEN 'Salvage'
        ELSE 'Regular'
      END AS product_type,
      COUNT(DISTINCT user_id) AS users
    FROM ${TABLES.decision_completed}
    WHERE decision = 'APPROVED'
      AND DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY 1
  `;

  return runQuery<ProductTypeRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
