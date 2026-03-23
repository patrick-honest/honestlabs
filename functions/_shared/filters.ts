/**
 * Server-side filter parsing and SQL generation.
 *
 * Filters are passed as query parameters from the frontend and converted
 * to BigQuery WHERE clauses. Each filter maps to specific table columns.
 *
 * IMPORTANT: All BigQuery tables are READ-ONLY. Queries are SELECT-only.
 */

import { TABLES } from "./bigquery-client";

export interface ParsedFilters {
  cardType: string[];
  productType: string[];
  cycleDate: string[];
  transactionType: string[];
  amountRange: string[];
  riskCategory: string[];
}

/**
 * Parse filter query parameters from the request URL.
 */
export function parseFilters(url: URL): ParsedFilters {
  return {
    cardType: parseCSV(url.searchParams.get("cardType")),
    productType: parseCSV(url.searchParams.get("productType")),
    cycleDate: parseCSV(url.searchParams.get("cycleDate")),
    transactionType: parseCSV(url.searchParams.get("transactionType")),
    amountRange: parseCSV(url.searchParams.get("amountRange")),
    riskCategory: parseCSV(url.searchParams.get("riskCategory")),
  };
}

function parseCSV(val: string | null): string[] {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

export function hasAnyFilter(f: ParsedFilters): boolean {
  return Object.values(f).some((arr) => arr.length > 0);
}

// ---------------------------------------------------------------------------
// SQL clause builders — each returns a WHERE fragment or empty string
// ---------------------------------------------------------------------------

/**
 * Card program filter (DW005).
 * @param alias Table alias for principal_card_updates (e.g., "pc")
 */
export function cardTypeWhere(f: ParsedFilters, alias = "pc"): string {
  if (f.cardType.length === 0) return "";
  const vals = f.cardType.map((v) => `'${sanitize(v)}'`).join(",");
  return `AND ${alias}.fx_dw005_crd_pgm IN (${vals})`;
}

/**
 * Product type filter on decision_completed.
 * regular = NOT prepaid AND NOT opening_fee
 * rp1 = is_prepaid_card_applicable = true
 * registration_fee = is_account_opening_fee_applicable = true
 * @param alias Table alias for decision_completed
 */
export function productTypeWhere(f: ParsedFilters, alias = "dc"): string {
  if (f.productType.length === 0) return "";
  const conditions: string[] = [];
  for (const pt of f.productType) {
    switch (pt) {
      case "regular":
        conditions.push(
          `(COALESCE(${alias}.is_prepaid_card_applicable, false) = false AND COALESCE(${alias}.is_account_opening_fee_applicable, false) = false)`
        );
        break;
      case "rp1":
        conditions.push(`${alias}.is_prepaid_card_applicable = true`);
        break;
      case "registration_fee":
        conditions.push(`${alias}.is_account_opening_fee_applicable = true`);
        break;
    }
  }
  if (conditions.length === 0) return "";
  return `AND (${conditions.join(" OR ")})`;
}

/**
 * Cycle date filter on DW004 financial_account_updates.
 * Cycle 4 or 26 based on f9_dw004_stm_due_dt day of month.
 * @param alias Table alias
 */
export function cycleDateWhere(f: ParsedFilters, alias = "dw4"): string {
  if (f.cycleDate.length === 0) return "";
  const days = f.cycleDate.map((v) => `${parseInt(v, 10)}`).join(",");
  return `AND EXTRACT(DAY FROM ${alias}.f9_dw004_stm_due_dt) IN (${days})`;
}

/**
 * Transaction type filter on DW007 authorized_transaction.
 * Maps frontend values to fx_dw007_txn_typ codes.
 */
const TXN_TYPE_MAP: Record<string, string[]> = {
  purchase: ["TM", "RA"],     // e-commerce + retail/QRIS
  cash_advance: ["AV"],       // cash advance
  payment: ["PM"],            // payment/repayment
  refund: ["RF"],             // refund/reversal
  fee: ["F"],                 // fee/charge
};

export function transactionTypeWhere(f: ParsedFilters, alias = "t"): string {
  if (f.transactionType.length === 0) return "";
  const codes: string[] = [];
  for (const tt of f.transactionType) {
    const mapped = TXN_TYPE_MAP[tt];
    if (mapped) codes.push(...mapped);
  }
  if (codes.length === 0) return "";
  const vals = codes.map((c) => `'${c}'`).join(",");
  return `AND ${alias}.fx_dw007_txn_typ IN (${vals})`;
}

/**
 * Amount range filter on DW007 authorized_transaction.
 * Ranges in IDR (f9_dw007_amt_req is in cents, divide by 100).
 */
const AMOUNT_RANGES: Record<string, [number, number]> = {
  micro: [0, 5000000],           // < 50K IDR (in cents)
  small: [5000000, 50000000],    // 50K–500K
  medium: [50000000, 500000000], // 500K–5M
  large: [500000000, 5000000000], // 5M–50M
  xlarge: [5000000000, Infinity], // > 50M
};

export function amountRangeWhere(f: ParsedFilters, alias = "t"): string {
  if (f.amountRange.length === 0) return "";
  const conditions: string[] = [];
  for (const ar of f.amountRange) {
    const range = AMOUNT_RANGES[ar];
    if (!range) continue;
    if (range[1] === Infinity) {
      conditions.push(`${alias}.f9_dw007_amt_req >= ${range[0]}`);
    } else {
      conditions.push(`(${alias}.f9_dw007_amt_req >= ${range[0]} AND ${alias}.f9_dw007_amt_req < ${range[1]})`);
    }
  }
  if (conditions.length === 0) return "";
  return `AND (${conditions.join(" OR ")})`;
}

/**
 * Build a combined filter clause for queries joining multiple tables.
 * Only includes clauses for tables present in the query.
 */
export function buildFilterClauses(
  f: ParsedFilters,
  tables: {
    principalCard?: string;    // alias for principal_card_updates
    decisionCompleted?: string; // alias for decision_completed
    financialAccount?: string;  // alias for financial_account_updates
    authorizedTxn?: string;     // alias for authorized_transaction
  },
): string {
  if (!hasAnyFilter(f)) return "";

  const parts: string[] = [];

  if (tables.principalCard) {
    parts.push(cardTypeWhere(f, tables.principalCard));
  }
  if (tables.decisionCompleted) {
    parts.push(productTypeWhere(f, tables.decisionCompleted));
  }
  if (tables.financialAccount) {
    parts.push(cycleDateWhere(f, tables.financialAccount));
  }
  if (tables.authorizedTxn) {
    parts.push(transactionTypeWhere(f, tables.authorizedTxn));
    parts.push(amountRangeWhere(f, tables.authorizedTxn));
  }

  return parts.filter(Boolean).join("\n        ");
}

// Simple sanitization to prevent SQL injection
function sanitize(val: string): string {
  return val.replace(/[^a-zA-Z0-9_-]/g, "");
}
