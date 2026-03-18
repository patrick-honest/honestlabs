"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export interface FilterSelections {
  cardType: string[];
  productType: string[];
  cohort: string[];
  cycleDate: string[];
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

export interface SavedFilterPreset {
  id: string;
  name: string;
  filters: FilterSelections;
}

interface FiltersContextValue {
  filters: FilterSelections;
  setFilter: (key: keyof FilterSelections, values: string[]) => void;
  toggleFilterValue: (key: keyof FilterSelections, value: string) => void;
  clearFilters: () => void;
  clearFilter: (key: keyof FilterSelections) => void;
  activeFilterCount: number;
  // Saved presets
  savedPresets: SavedFilterPreset[];
  savePreset: (name: string) => string; // returns id
  loadPreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  suggestPresetName: () => string;
}

/**
 * Default filter state — all empty (show all data).
 * Users can apply filters via the header panel and save
 * named filter combinations for quick recall.
 */
const DEFAULT_FILTERS: FilterSelections = {
  cardType: [],
  productType: [],
  cohort: [],
  cycleDate: [],
  transactionType: [],
  transactionChannel: [],
  transactionStatus: [],
  merchantCategory: [],
  amountRange: [],
  recurringType: [],
  riskCategory: [],
  decisioningModel: [],
};

/** Alias for clarity — both are the same now */
const EMPTY_FILTERS = DEFAULT_FILTERS;

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
 * **RP1** — RP1 card product where the user deposits funds upfront (credit_limit = 1).
 *   Identified by: is_prepaid_card_applicable = TRUE (or F9_DW001_LOC_LMT = 1)
 *   These users have no revolving credit — spend is limited to deposited amount.
 *
 * **Registration Fee** — Credit card with an upfront account opening fee charged at issuance.
 *   Identified by: is_account_opening_fee_applicable = TRUE
 *   Has a standard credit line but user paid a fee to open the account.
 *
 * By default, all product types are shown (no filters applied).
 * Users can select specific product types via the Product filter.
 */
export const PRODUCT_TYPE_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "rp1", label: "RP1" },
  { value: "registration_fee", label: "Registration Fee" },
] as const;

/** Product types selected by default (empty = all shown) */
export const DEFAULT_PRODUCT_TYPES: string[] = [];

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
  { value: "groceries", label: "Groceries & Supermarkets", labelKey: "merchantCategories.groceries" },
  { value: "restaurants", label: "Restaurants & Food Delivery", labelKey: "merchantCategories.restaurants" },
  { value: "transportation", label: "Transportation & Ride-hailing", labelKey: "merchantCategories.transportation" },
  { value: "entertainment", label: "Entertainment & Streaming", labelKey: "merchantCategories.entertainment" },
  { value: "utilities", label: "Utilities & Bills", labelKey: "merchantCategories.utilities" },
  { value: "shopping", label: "Retail & Shopping", labelKey: "merchantCategories.shopping" },
  { value: "travel", label: "Travel & Hotels", labelKey: "merchantCategories.travel" },
  { value: "health", label: "Health & Pharmacy", labelKey: "merchantCategories.health" },
  { value: "education", label: "Education", labelKey: "merchantCategories.education" },
  { value: "government", label: "Government & Tax", labelKey: "merchantCategories.government" },
  { value: "digital_goods", label: "Digital Goods & Services", labelKey: "merchantCategories.digitalGoods" },
  { value: "other", label: "Other", labelKey: "merchantCategories.other" },
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

// ── Cycle Date filter (statement due day of month) ──────────────────
export const CYCLE_DATE_OPTIONS = [
  { value: "4", label: "Cycle 4th" },
  { value: "26", label: "Cycle 26th" },
] as const;

const FILTERS_STORAGE_KEY = "honest_filter_prefs";
const PRESETS_STORAGE_KEY = "honest_filter_presets";

function loadFilterPrefs(): FilterSelections | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Validate shape — must have all keys as arrays
    for (const key of Object.keys(DEFAULT_FILTERS)) {
      if (!Array.isArray(parsed[key])) return null;
    }
    return parsed;
  } catch { return null; }
}

function saveFilterPrefs(filters: FilterSelections) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters)); }
  catch { /* ignore */ }
}

function loadPresets(): SavedFilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePresets(presets: SavedFilterPreset[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets)); }
  catch { /* ignore */ }
}

/** Generate a suggested name based on the active filter selections */
function generatePresetName(filters: FilterSelections): string {
  const parts: string[] = [];
  if (filters.productType.length > 0) {
    const labels = filters.productType.map((v) => {
      if (v === "regular") return "Regular";
      if (v === "rp1") return "RP1";
      if (v === "registration_fee") return "Reg Fee";
      return v;
    });
    parts.push(labels.join("+"));
  }
  if (filters.cardType.length > 0) {
    parts.push(`Card:${filters.cardType.length}`);
  }
  if (filters.riskCategory.length > 0) {
    parts.push(`Risk:${filters.riskCategory.join(",")}`);
  }
  if (filters.transactionChannel.length > 0) {
    parts.push(`Ch:${filters.transactionChannel.length}`);
  }
  if (filters.merchantCategory.length > 0) {
    parts.push(`MCC:${filters.merchantCategory.length}`);
  }
  if (filters.cohort.length > 0) {
    parts.push("Cohort");
  }
  const total = Object.values(filters).reduce((s, a) => s + a.length, 0);
  if (parts.length === 0) return `Filter Set (${total} filters)`;
  return parts.join(" · ");
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  // Initialize with defaults — hydrate from localStorage after mount to avoid SSR mismatch
  const [filters, setFiltersRaw] = useState<FilterSelections>(DEFAULT_FILTERS);
  const [savedPresets, setSavedPresetsRaw] = useState<SavedFilterPreset[]>([]);

  // Hydrate from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    const savedFilters = loadFilterPrefs();
    if (savedFilters) setFiltersRaw(savedFilters);
    const savedP = loadPresets();
    if (savedP.length > 0) setSavedPresetsRaw(savedP);
  }, []);

  // Wrap setFilters to persist
  const setFilters = useCallback((updater: FilterSelections | ((prev: FilterSelections) => FilterSelections)) => {
    setFiltersRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveFilterPrefs(next);
      return next;
    });
  }, []);

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

  // Count total active filter values across all dimensions
  const activeFilterCount = Object.values(filters).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  // ── Saved presets ─────────────────────────────────────────────────

  const updatePresets = useCallback((updater: (prev: SavedFilterPreset[]) => SavedFilterPreset[]) => {
    setSavedPresetsRaw((prev) => {
      const next = updater(prev);
      savePresets(next);
      return next;
    });
  }, []);

  const savePreset = useCallback((name: string): string => {
    const id = `preset_${Date.now()}`;
    const preset: SavedFilterPreset = { id, name, filters: { ...filters } };
    updatePresets((prev) => [...prev, preset]);
    return id;
  }, [filters, updatePresets]);

  const loadPresetFn = useCallback((id: string) => {
    const preset = savedPresets.find((p) => p.id === id);
    if (preset) setFilters(preset.filters);
  }, [savedPresets, setFilters]);

  const renamePreset = useCallback((id: string, name: string) => {
    updatePresets((prev) => prev.map((p) => p.id === id ? { ...p, name } : p));
  }, [updatePresets]);

  const deletePreset = useCallback((id: string) => {
    updatePresets((prev) => prev.filter((p) => p.id !== id));
  }, [updatePresets]);

  const suggestPresetName = useCallback(() => {
    return generatePresetName(filters);
  }, [filters]);

  return (
    <FiltersContext.Provider
      value={{
        filters, setFilter, toggleFilterValue, clearFilters, clearFilter, activeFilterCount,
        savedPresets, savePreset, loadPreset: loadPresetFn, renamePreset, deletePreset, suggestPresetName,
      }}
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
