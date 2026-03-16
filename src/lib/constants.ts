// Account status codes (DW004 fx_dw004_loc_stat)
export const ACCOUNT_STATUS = {
  G: "Good Standing",
  N: "Normal",
  B: "Blocked",
  C: "Closed",
  F: "Fraud",
  D: "Delinquent",
  W: "Write-Off",
} as const;

// Transaction types (DW007 fx_dw007_txn_typ)
export const TXN_TYPES = {
  TM: "Online (E-commerce)",
  RA: "Retail Authorization",
  PM: "Payment",
  BE: "Balance Enquiry",
  RF: "Refund",
  CP: "Cash Purchase",
  CA: "Cash Advance",
  QP: "Quick Payment",
} as const;

// Transaction type categories for spend analysis
export const SPEND_CATEGORIES = {
  online: { label: "Online", filter: "FX_DW007_TXN_TYP = 'TM'" },
  qris: { label: "QRIS", filter: "FX_DW007_TXN_TYP = 'RA' AND fx_dw007_rte_dest = 'L'" },
  offline: { label: "Offline (POS/Tap)", filter: "FX_DW007_TXN_TYP != 'TM' AND NOT (FX_DW007_TXN_TYP = 'RA' AND fx_dw007_rte_dest = 'L')" },
} as const;

// Excluded transaction types for valid spend
export const EXCLUDED_TXN_TYPES = ["PM", "BE", "RF"];

// Valid spend filter (DW007)
export const VALID_SPEND_FILTER = `
  (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
  AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
`;

// DPD buckets for aging analysis
export const DPD_BUCKETS = [
  { label: "Current", min: 0, max: 0 },
  { label: "1-30 DPD", min: 1, max: 30 },
  { label: "31-60 DPD", min: 31, max: 60 },
  { label: "61-90 DPD", min: 61, max: 90 },
  { label: "90+ DPD", min: 91, max: 9999 },
] as const;

// Decision outcomes
export const DECISION_OUTCOMES = {
  APPROVED: "Approved",
  DECLINED: "Declined",
  WAITLISTED: "Waitlisted",
} as const;

// Product types based on decision flags
export const PRODUCT_TYPES = {
  prepaid: { label: "Prepaid Card", filter: "is_prepaid_card_applicable = TRUE" },
  opening_fee: { label: "Opening Fee Card", filter: "is_account_opening_fee_applicable = TRUE" },
  standard: { label: "Standard Credit Card", filter: "(is_prepaid_card_applicable IS NULL OR is_prepaid_card_applicable = FALSE) AND (is_account_opening_fee_applicable IS NULL OR is_account_opening_fee_applicable = FALSE)" },
} as const;

// Chart colors
export const CHART_COLORS = {
  primary: "#2563eb",    // blue-600
  secondary: "#7c3aed",  // violet-600
  success: "#16a34a",    // green-600
  warning: "#d97706",    // amber-600
  danger: "#dc2626",     // red-600
  muted: "#6b7280",      // gray-500
  online: "#2563eb",
  offline: "#7c3aed",
  qris: "#16a34a",
} as const;
