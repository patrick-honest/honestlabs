"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface FilterSelections {
  cardType: string[];
  productType: string[];
  cohort: string[];
  // Transaction filters
  transactionType: string[];
  transactionChannel: string[];
  transactionStatus: string[];
  merchantCategory: string[];
  amountRange: string[];
  recurringType: string[];
  // Risk & decisioning filters
  riskCategory: string[];
  decisioningModel: string[];
}

interface FiltersContextValue {
  filters: FilterSelections;
  setFilter: (key: keyof FilterSelections, values: string[]) => void;
  toggleFilterValue: (key: keyof FilterSelections, value: string) => void;
  clearFilters: () => void;
  clearFilter: (key: keyof FilterSelections) => void;
  activeFilterCount: number;
}

/**
 * Default filter state.
 *
 * productType defaults to ["regular"] so RP1 and Registration Fee
 * users are excluded from metrics by default. Users can toggle them
 * on via the Product filter. An empty array means "show all" for
 * every other dimension.
 */
const DEFAULT_FILTERS: FilterSelections = {
  cardType: [],
  productType: ["regular"], // Regular only by default; RP1 + Reg Fee excluded
  cohort: [],
  transactionType: [],
  transactionChannel: [],
  transactionStatus: [],
  merchantCategory: [],
  amountRange: [],
  recurringType: [],
  riskCategory: [],
  decisioningModel: [],
};

/** Fully empty filters (used when clearing all) */
const EMPTY_FILTERS: FilterSelections = {
  cardType: [],
  productType: [],
  cohort: [],
  transactionType: [],
  transactionChannel: [],
  transactionStatus: [],
  merchantCategory: [],
  amountRange: [],
  recurringType: [],
  riskCategory: [],
  decisioningModel: [],
};

const FiltersContext = createContext<FiltersContextValue | undefined>(undefined);

// Card Type = fx_dw005_crd_pgm values (0xxxx = MC, 1xxxx = VS)
export const CARD_TYPE_OPTIONS = [
  { value: "00002", label: "00002", group: "Mastercard" },
  { value: "00003", label: "00003", group: "Mastercard" },
  { value: "00004", label: "00004", group: "Mastercard" },
  { value: "00006", label: "00006", group: "Mastercard" },
  { value: "00011", label: "00011", group: "Mastercard" },
  { value: "00016", label: "00016", group: "Mastercard" },
  { value: "00021", label: "00021", group: "Mastercard" },
  { value: "00024", label: "00024", group: "Mastercard" },
  { value: "00027", label: "00027", group: "Mastercard" },
  { value: "10015", label: "10015", group: "Visa" },
  { value: "10016", label: "10016", group: "Visa" },
  { value: "10021", label: "10021", group: "Visa" },
  { value: "10027", label: "10027", group: "Visa" },
] as const;

/**
 * Product type definitions:
 *
 * **Regular** — Standard credit card with full credit line. The core product.
 *   Identified by: is_prepaid_card_applicable = FALSE AND is_account_opening_fee_applicable = FALSE
 *
 * **RP1 (Prepaid)** — Prepaid card product where the user deposits funds upfront (credit_limit = 1).
 *   Identified by: is_prepaid_card_applicable = TRUE (or F9_DW001_LOC_LMT = 1)
 *   These users have no revolving credit — spend is limited to deposited amount.
 *
 * **Registration Fee** — Credit card with an upfront account opening fee charged at issuance.
 *   Identified by: is_account_opening_fee_applicable = TRUE
 *   Has a standard credit line but user paid a fee to open the account.
 *
 * By default, RP1 and Registration Fee are UNSELECTED so that dashboard
 * metrics reflect the core Regular credit card portfolio. Users can toggle
 * them on via the Product filter to see the full picture.
 */
export const PRODUCT_TYPE_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "rp1", label: "RP1 (Prepaid)" },
  { value: "registration_fee", label: "Registration Fee" },
] as const;

/** Product types selected by default (Regular only — RP1 and Reg Fee excluded) */
export const DEFAULT_PRODUCT_TYPES: string[] = ["regular"];

// ── Transaction filter options ──────────────────────────────────────

export const TRANSACTION_TYPE_OPTIONS = [
  { value: "purchase", label: "Purchase" },
  { value: "cash_advance", label: "Cash Advance" },
  { value: "balance_transfer", label: "Balance Transfer" },
  { value: "payment", label: "Payment / Repayment" },
  { value: "fee", label: "Fee / Charge" },
  { value: "refund", label: "Refund / Reversal" },
  { value: "interest", label: "Interest" },
] as const;

export const TRANSACTION_CHANNEL_OPTIONS = [
  // Online channels
  { value: "ecommerce", label: "E-commerce", group: "Online" },
  { value: "in_app", label: "In-App Purchase", group: "Online" },
  { value: "online_subscription", label: "Subscription / Recurring", group: "Online" },
  { value: "digital_wallet_online", label: "Digital Wallet (Online)", group: "Online" },
  { value: "transfer", label: "Transfer / Remittance", group: "Online" },
  { value: "auto_debit", label: "Auto Debit / Standing Order", group: "Online" },
  // Offline channels
  { value: "pos_chip", label: "POS — Chip", group: "Offline" },
  { value: "pos_swipe", label: "POS — Swipe", group: "Offline" },
  { value: "contactless_nfc", label: "Contactless / NFC", group: "Offline" },
  { value: "tap_to_pay", label: "Tap to Pay (Apple/Google)", group: "Offline" },
  { value: "atm", label: "ATM Withdrawal", group: "Offline" },
  { value: "cash_advance_otc", label: "Cash Advance (OTC)", group: "Offline" },
  // QRIS channels
  { value: "qris_static", label: "QRIS — Static QR", group: "QRIS" },
  { value: "qris_dynamic", label: "QRIS — Dynamic QR", group: "QRIS" },
  { value: "qris_nfc", label: "QRIS — NFC", group: "QRIS" },
] as const;

export const TRANSACTION_STATUS_OPTIONS = [
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "reversed", label: "Reversed" },
  { value: "pending", label: "Pending" },
  { value: "settled", label: "Settled" },
] as const;

export const MERCHANT_CATEGORY_OPTIONS = [
  { value: "groceries", label: "Groceries & Supermarkets" },
  { value: "restaurants", label: "Restaurants & Food Delivery" },
  { value: "transportation", label: "Transportation & Ride-hailing" },
  { value: "entertainment", label: "Entertainment & Streaming" },
  { value: "utilities", label: "Utilities & Bills" },
  { value: "shopping", label: "Retail & Shopping" },
  { value: "travel", label: "Travel & Hotels" },
  { value: "health", label: "Health & Pharmacy" },
  { value: "education", label: "Education" },
  { value: "government", label: "Government & Tax" },
  { value: "digital_goods", label: "Digital Goods & Services" },
  { value: "other", label: "Other" },
] as const;

export const AMOUNT_RANGE_OPTIONS = [
  { value: "micro", label: "Micro (< Rp 50K)" },
  { value: "small", label: "Small (Rp 50K–500K)" },
  { value: "medium", label: "Medium (Rp 500K–5M)" },
  { value: "large", label: "Large (Rp 5M–50M)" },
  { value: "xlarge", label: "Very Large (> Rp 50M)" },
] as const;

export const RECURRING_TYPE_OPTIONS = [
  { value: "one_time", label: "One-time" },
  { value: "recurring", label: "Recurring" },
  { value: "subscription", label: "Subscription" },
  { value: "installment", label: "Installment" },
  { value: "auto_pay", label: "Auto-pay" },
] as const;

// ── Risk & Decisioning filter options ───────────────────────────────

// Risk Category = A–J, Z, or null
export const RISK_CATEGORY_OPTIONS = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "D", label: "D" },
  { value: "E", label: "E" },
  { value: "F", label: "F" },
  { value: "G", label: "G" },
  { value: "H", label: "H" },
  { value: "I", label: "I" },
  { value: "J", label: "J" },
  { value: "Z", label: "Z" },
  { value: "null", label: "Null / Unassigned" },
] as const;

export const DECISIONING_MODEL_OPTIONS = [
  { value: "v1_launch", label: "V1 — Launch Model" },
  { value: "v2_refined", label: "V2 — Refined Scorecard" },
  { value: "v3_ml", label: "V3 — ML-enhanced" },
  { value: "v4_current", label: "V4 — Current Production" },
  { value: "champion", label: "Champion" },
  { value: "challenger_a", label: "Challenger A" },
  { value: "challenger_b", label: "Challenger B" },
  { value: "manual_override", label: "Manual Override" },
] as const;

// Generate weekly cohorts for the last ~6 months
function generateWeeklyCohorts(): { value: string; label: string }[] {
  const cohorts: { value: string; label: string }[] = [];
  const now = new Date(2026, 2, 16); // Mar 16, 2026
  for (let i = 0; i < 26; i++) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startStr = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const value = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + weekStart.getDay()) / 7)).padStart(2, "0")}`;
    cohorts.push({
      value: `${weekStart.toISOString().slice(0, 10)}`,
      label: `${startStr} – ${endStr}`,
    });
  }
  return cohorts;
}

export const COHORT_OPTIONS = generateWeeklyCohorts();

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterSelections>(DEFAULT_FILTERS);

  const setFilter = useCallback(
    (key: keyof FilterSelections, values: string[]) => {
      setFilters((prev) => ({ ...prev, [key]: values }));
    },
    []
  );

  const toggleFilterValue = useCallback(
    (key: keyof FilterSelections, value: string) => {
      setFilters((prev) => {
        const current = prev[key];
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        return { ...prev, [key]: next };
      });
    },
    []
  );

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const clearFilter = useCallback(
    (key: keyof FilterSelections) => {
      setFilters((prev) => ({ ...prev, [key]: [] }));
    },
    []
  );

  // Count filters that differ from defaults (so default productType: ["regular"] doesn't count)
  function countNonDefault(key: keyof FilterSelections): number {
    const current = filters[key];
    const def = DEFAULT_FILTERS[key];
    if (current.length === def.length && current.every((v, i) => v === def[i])) return 0;
    return current.length;
  }

  const activeFilterCount =
    countNonDefault("cardType") +
    countNonDefault("productType") +
    countNonDefault("cohort") +
    countNonDefault("transactionType") +
    countNonDefault("transactionChannel") +
    countNonDefault("transactionStatus") +
    countNonDefault("merchantCategory") +
    countNonDefault("amountRange") +
    countNonDefault("recurringType") +
    countNonDefault("riskCategory") +
    countNonDefault("decisioningModel");

  return (
    <FiltersContext.Provider
      value={{ filters, setFilter, toggleFilterValue, clearFilters, clearFilter, activeFilterCount }}
    >
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within FiltersProvider");
  return ctx;
}
