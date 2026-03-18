/**
 * Shared utilities for applying filter selections to mock/sample data.
 *
 * Since the current data is mock/sample, filters work by:
 * 1. Generating a deterministic multiplier based on active filter selections
 *    (so the data visually changes when filters are toggled)
 * 2. Providing a human-readable description of active filters
 *
 * When real BigQuery data is connected, filters will instead be passed as
 * query parameters to the API endpoints and applied as WHERE clauses.
 */

import type { FilterSelections } from "@/hooks/use-filters";
import {
  CARD_TYPE_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  TRANSACTION_CHANNEL_OPTIONS,
  TRANSACTION_STATUS_OPTIONS,
  MERCHANT_CATEGORY_OPTIONS,
  AMOUNT_RANGE_OPTIONS,
  RECURRING_TYPE_OPTIONS,
  RISK_CATEGORY_OPTIONS,
  DECISIONING_MODEL_OPTIONS,
  COHORT_OPTIONS,
} from "@/hooks/use-filters";

// ---------------------------------------------------------------------------
// Filter multiplier — deterministic scaling based on active selections
// ---------------------------------------------------------------------------

/**
 * Compute a scaling factor based on the active filter selections.
 *
 * The idea: selecting a *subset* of filter values implies the user is looking
 * at a smaller slice of the data, so we scale the absolute numbers down while
 * keeping rates / percentages roughly the same. The multiplier is the product
 * of (selected / total) ratios across all active filter groups.
 *
 * When no filters are active, returns 1.0 (show full data).
 */
export function getFilterMultiplier(filters: FilterSelections): number {
  let multiplier = 1.0;

  const ratios: [string[], number][] = [
    [filters.cardType, CARD_TYPE_OPTIONS.length],
    [filters.productType, PRODUCT_TYPE_OPTIONS.length],
    [filters.cohort, COHORT_OPTIONS.length],
    [filters.transactionType, TRANSACTION_TYPE_OPTIONS.length],
    [filters.transactionChannel, TRANSACTION_CHANNEL_OPTIONS.length],
    [filters.transactionStatus, TRANSACTION_STATUS_OPTIONS.length],
    [filters.merchantCategory, MERCHANT_CATEGORY_OPTIONS.length],
    [filters.amountRange, AMOUNT_RANGE_OPTIONS.length],
    [filters.recurringType, RECURRING_TYPE_OPTIONS.length],
    [filters.riskCategory, RISK_CATEGORY_OPTIONS.length],
    [filters.decisioningModel, DECISIONING_MODEL_OPTIONS.length],
  ];

  for (const [selected, total] of ratios) {
    if (selected.length > 0) {
      multiplier *= selected.length / total;
    }
  }

  // Clamp to a minimum of 5% so charts never fully disappear
  return Math.max(0.05, multiplier);
}

/**
 * Apply filter multiplier to an array of data points.
 * - Numeric fields that look like counts / volumes / amounts are scaled.
 * - Fields that look like rates / percentages (0–100 range or key contains
 *   "rate", "pct", "percent") are shifted slightly instead of scaled.
 * - String fields (like "date" labels) are left untouched.
 */
export function applyFilterToData<T extends Record<string, unknown>>(
  data: T[],
  filters: FilterSelections,
): T[] {
  const m = getFilterMultiplier(filters);
  if (m === 1.0) return data;

  return data.map((row) => {
    const newRow = { ...row };
    for (const [key, value] of Object.entries(row)) {
      if (typeof value !== "number") continue;

      const isRate =
        key.toLowerCase().includes("rate") ||
        key.toLowerCase().includes("pct") ||
        key.toLowerCase().includes("percent") ||
        (value >= 0 && value <= 100 && key !== "count" && key !== "volume" && key !== "amount");

      if (isRate) {
        // Shift rate slightly (±0–3pp) based on multiplier so it's visible but not absurd
        const shift = (1 - m) * 2; // smaller slice → slightly lower rate
        newRow[key as keyof T] = Math.max(0, +(value - shift).toFixed(2)) as T[keyof T];
      } else {
        newRow[key as keyof T] = Math.round(value * m) as T[keyof T];
      }
    }
    return newRow;
  });
}

/**
 * Scale a single metric value by the filter multiplier.
 */
export function applyFilterToMetric(
  value: number,
  filters: FilterSelections,
  isRate: boolean,
): number {
  const m = getFilterMultiplier(filters);
  if (m === 1.0) return value;
  if (isRate) {
    const shift = (1 - m) * 2;
    return Math.max(0, +(value - shift).toFixed(2));
  }
  return Math.round(value * m);
}

// ---------------------------------------------------------------------------
// Human-readable filter description
// ---------------------------------------------------------------------------

const FILTER_LABELS: Record<keyof FilterSelections, string> = {
  cardType: "Card Type",
  productType: "Product",
  cohort: "Cohort",
  cycleDate: "Cycle",
  transactionType: "Txn Type",
  transactionChannel: "Channel",
  transactionStatus: "Status",
  merchantCategory: "MCC",
  amountRange: "Amount",
  recurringType: "Recurring",
  riskCategory: "Risk",
  decisioningModel: "Model",
};

/**
 * Build a short human-readable summary of active filters.
 * Returns null if no filters are active.
 *
 * Example: "Card Type (3) · Risk (2) · Channel (5)"
 */
export function getFilterSummary(filters: FilterSelections): string | null {
  const parts: string[] = [];

  for (const key of Object.keys(FILTER_LABELS) as (keyof FilterSelections)[]) {
    const count = filters[key].length;
    if (count > 0) {
      parts.push(`${FILTER_LABELS[key]} (${count})`);
    }
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Count total active filter selections across all groups.
 */
export function getActiveFilterCount(filters: FilterSelections): number {
  return Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);
}

/**
 * Check if any filters are currently active.
 */
export function hasActiveFilters(filters: FilterSelections): boolean {
  return Object.values(filters).some((arr) => arr.length > 0);
}

/**
 * Build a query string from active filters (for future API integration).
 */
export function filtersToQueryParams(filters: FilterSelections): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, values] of Object.entries(filters)) {
    if ((values as string[]).length > 0) {
      params.set(key, (values as string[]).join(","));
    }
  }
  return params;
}
