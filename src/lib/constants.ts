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
  qris: {
    label: "QRIS",
    filter: "COALESCE(FX_DW007_STAT, '', ' ') IN ('', ' ') AND FX_DW007_TXN_TYP NOT IN ('PM', 'RF', 'BE') AND fx_dw007_rte_dest = 'L'",
  },
  offline: {
    label: "Offline (POS/Tap)",
    filter: "COALESCE(FX_DW007_STAT, '', ' ') IN ('', ' ') AND FX_DW007_TXN_TYP NOT IN ('PM', 'RF', 'BE', 'TM')",
  },
  online: {
    label: "Online",
    filter: "COALESCE(FX_DW007_STAT, '', ' ') IN ('', ' ') AND FX_DW007_TXN_TYP NOT IN ('PM', 'RF', 'BE') AND FX_DW007_TXN_TYP = 'TM'",
  },
} as const;

// Excluded transaction types for valid spend
export const EXCLUDED_TXN_TYPES = ["PM", "BE", "RF"];

// Valid spend filter (DW007)
export const VALID_SPEND_FILTER = `
  COALESCE(FX_DW007_STAT, '', ' ') IN ('', ' ')
  AND FX_DW007_TXN_TYP NOT IN ('PM', 'RF', 'BE')
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

// Chart colors — Honest brand palette
export const CHART_COLORS = {
  primary: "#5B22FF",     // honest purple
  secondary: "#7C4DFF",   // honest purple light
  success: "#06D6A0",     // teal (split complementary)
  warning: "#FFD166",     // amber
  danger: "#FF6B6B",      // coral
  muted: "#6B6394",       // muted purple
  online: "#5B22FF",      // purple for online
  offline: "#7C4DFF",     // lighter purple for offline
  qris: "#06D6A0",        // teal for QRIS
  // Extended palette for multi-series charts
  chart1: "#5B22FF",
  chart2: "#06D6A0",
  chart3: "#FFD166",
  chart4: "#FF6B6B",
  chart5: "#7C4DFF",
  chart6: "#4ECDC4",
  chart7: "#FF8C42",
  chart8: "#95E1D3",
} as const;
