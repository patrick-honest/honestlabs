/**
 * Per-page filter visibility configuration.
 *
 * Maps route prefixes to the set of filter keys that are relevant for that
 * page. Filters not listed for a route are hidden from the header panel and
 * their selections are auto-cleared on navigation so stale cross-page
 * filters don't silently skew data.
 *
 * A missing route (or `null`) means "show ALL filters" (the default).
 * An empty array means "show NO filters" (e.g. admin pages).
 */

import type { FilterSelections } from "@/hooks/use-filters";

export type FilterKey = keyof FilterSelections;

/** Account-level filters applicable to almost every page */
const ACCT: FilterKey[] = ["cardType", "productType", "cohort"];

/** Full risk group */
const RISK: FilterKey[] = ["riskCategory", "decisioningModel"];

/** Full transaction group */
const TXN: FilterKey[] = [
  "transactionType",
  "transactionChannel",
  "transactionStatus",
  "merchantCategory",
  "amountRange",
  "recurringType",
];

/** All 11 filter dimensions */
const ALL: FilterKey[] = [...ACCT, ...TXN, ...RISK];

/**
 * Route prefix → visible filter keys.
 *
 * Matched top-down: the first prefix that matches `pathname.startsWith(prefix)`
 * wins. More specific routes should appear before general ones.
 */
export const PAGE_FILTER_CONFIG: { prefix: string; filters: FilterKey[] | null }[] = [
  // ── Admin / utility pages (no filters) ──
  { prefix: "/admin", filters: [] },
  { prefix: "/search", filters: [] },
  { prefix: "/metrics", filters: [] },

  // ── Deep dive pages ──
  {
    prefix: "/deep-dive/acquisition",
    filters: [...ACCT, "riskCategory", "decisioningModel"],
  },
  {
    prefix: "/deep-dive/activation",
    filters: [...ACCT],
  },
  {
    prefix: "/deep-dive/spend",
    filters: ALL, // transaction-heavy — all filters apply
  },
  {
    prefix: "/deep-dive/portfolio",
    filters: [...ACCT, "riskCategory"],
  },
  {
    prefix: "/deep-dive/repayments",
    filters: [...ACCT, "transactionChannel", "amountRange"],
  },
  {
    prefix: "/deep-dive/collections",
    filters: [...ACCT, "riskCategory", "decisioningModel"],
  },
  {
    prefix: "/deep-dive/risk",
    filters: [...ACCT, ...RISK],
  },
  {
    prefix: "/deep-dive/customer-service",
    filters: [...ACCT, "transactionType", "transactionChannel"],
  },
  {
    prefix: "/deep-dive/transaction-auth",
    filters: ALL, // transaction-heavy — all filters apply
  },
  {
    prefix: "/deep-dive/app-health",
    filters: [...ACCT],
  },
  {
    prefix: "/deep-dive/referral",
    filters: [...ACCT],
  },
  {
    prefix: "/deep-dive/credit-line",
    filters: [...ACCT],
  },
  {
    prefix: "/deep-dive/points-program",
    filters: [...ACCT],
  },

  // ── Top-level pages ──
  {
    prefix: "/channel-quality",
    filters: [...ACCT, ...RISK],
  },
  {
    prefix: "/orico",
    filters: [...ACCT, "riskCategory"],
  },
  {
    prefix: "/vintage",
    filters: [...ACCT, ...RISK],
  },
  {
    prefix: "/qris-experiment",
    filters: [
      "transactionChannel",
      "merchantCategory",
      "amountRange",
      "transactionStatus",
    ],
  },
  {
    prefix: "/reports",
    filters: ALL,
  },

  // ── Dashboard (default — all filters) ──
  { prefix: "/dashboard", filters: null },
];

/**
 * Resolve visible filter keys for a given pathname.
 * Returns `null` if all filters should be shown.
 */
export function getVisibleFilters(pathname: string): FilterKey[] | null {
  for (const entry of PAGE_FILTER_CONFIG) {
    if (pathname.startsWith(entry.prefix)) {
      return entry.filters;
    }
  }
  // Unknown route — show all
  return null;
}

/**
 * Given the full set of visible filter keys, return only the FILTER_GROUPS
 * entries that contain at least one visible filter, with non-visible filters
 * pruned from each group.
 */
export function isFilterVisible(
  key: FilterKey,
  visibleKeys: FilterKey[] | null
): boolean {
  if (visibleKeys === null) return true; // null = show all
  return visibleKeys.includes(key);
}
