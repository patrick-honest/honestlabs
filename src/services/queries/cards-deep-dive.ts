import { runQuery, TABLES } from "@/lib/bigquery";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardStatusBreakdownRow {
  status: string;
  accounts: number;
}

export interface CardProgramBreakdownRow {
  card_pgm: string;
  brand: string;
  accounts: number;
}

export interface VerificationBreakdownRow {
  verification: string;
  accounts: number;
}

// ---------------------------------------------------------------------------
// 1. Card Status Breakdown (DW005)
// ---------------------------------------------------------------------------

export async function getCardStatusBreakdown(): Promise<CardStatusBreakdownRow[]> {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(fx_dw005_crd_stat), ''), 'Active') AS status,
      COUNT(DISTINCT f9_dw005_loc_acct) AS accounts
    FROM ${TABLES.principal_card_updates}
    GROUP BY status
    ORDER BY accounts DESC
  `;

  return runQuery<CardStatusBreakdownRow>(sql);
}

// ---------------------------------------------------------------------------
// 2. Card Program Breakdown with Brand mapping (DW005)
// ---------------------------------------------------------------------------

export async function getCardProgramBreakdown(): Promise<CardProgramBreakdownRow[]> {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(fx_dw005_crd_pgm), ''), 'Unknown') AS card_pgm,
      CASE
        WHEN fx_dw005_crd_pgm LIKE '0%' THEN 'Mastercard'
        WHEN fx_dw005_crd_pgm LIKE '1%' THEN 'Visa'
        ELSE 'Other'
      END AS brand,
      COUNT(DISTINCT f9_dw005_loc_acct) AS accounts
    FROM ${TABLES.principal_card_updates}
    GROUP BY card_pgm, brand
    ORDER BY accounts DESC
    LIMIT 15
  `;

  return runQuery<CardProgramBreakdownRow>(sql);
}

// ---------------------------------------------------------------------------
// 3. Verification Breakdown — Video Verified vs Not (DW005)
// ---------------------------------------------------------------------------

export async function getVerificationBreakdown(): Promise<VerificationBreakdownRow[]> {
  const sql = `
    SELECT
      CASE
        WHEN f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL AND TRIM(CAST(f9_dw005_1st_unblk_all_mtd_tms AS STRING)) != '' THEN 'Video Verified'
        ELSE 'Not Verified'
      END AS verification,
      COUNT(DISTINCT f9_dw005_loc_acct) AS accounts
    FROM ${TABLES.principal_card_updates}
    GROUP BY verification
  `;

  return runQuery<VerificationBreakdownRow>(sql);
}
