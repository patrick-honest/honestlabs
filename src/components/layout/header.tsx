"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { usePeriod, COMPARISON_OPTIONS, type ComparisonMode } from "@/hooks/use-period";
import { useTheme } from "@/hooks/use-theme";
import {
  useFilters,
  CARD_TYPE_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  COHORT_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  TRANSACTION_CHANNEL_OPTIONS,
  TRANSACTION_STATUS_OPTIONS,
  MERCHANT_CATEGORY_OPTIONS,
  AMOUNT_RANGE_OPTIONS,
  RECURRING_TYPE_OPTIONS,
  RISK_CATEGORY_OPTIONS,
  DECISIONING_MODEL_OPTIONS,
  type FilterSelections,
} from "@/hooks/use-filters";
import { HeaderFilterDropdown } from "@/components/filters/header-filter-dropdown";
import { getVisibleFilters, isFilterVisible, type FilterKey } from "@/lib/page-filter-config";
import { Sun, Moon, Calendar, ChevronDown, X } from "lucide-react";
import type { Cycle } from "@/types/reports";

const CYCLES: { value: Cycle; label: string }[] = [
  { value: "weekly", label: "W" },
  { value: "monthly", label: "M" },
  { value: "quarterly", label: "Q" },
  { value: "yearly", label: "Y" },
];

interface FilterGroup {
  label: string;
  filters: {
    key: keyof FilterSelections;
    label: string;
    options: readonly { readonly value: string; readonly label: string; readonly group?: string }[];
  }[];
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    label: "Acct",
    filters: [
      { key: "cardType", label: "Card", options: CARD_TYPE_OPTIONS },
      { key: "productType", label: "Product", options: PRODUCT_TYPE_OPTIONS },
      { key: "cohort", label: "Cohort", options: COHORT_OPTIONS },
    ],
  },
  {
    label: "Txn",
    filters: [
      { key: "transactionType", label: "Type", options: TRANSACTION_TYPE_OPTIONS },
      { key: "transactionChannel", label: "Channel", options: TRANSACTION_CHANNEL_OPTIONS },
      { key: "transactionStatus", label: "Status", options: TRANSACTION_STATUS_OPTIONS },
      { key: "merchantCategory", label: "MCC", options: MERCHANT_CATEGORY_OPTIONS },
      { key: "amountRange", label: "Amount", options: AMOUNT_RANGE_OPTIONS },
      { key: "recurringType", label: "Recurring", options: RECURRING_TYPE_OPTIONS },
    ],
  },
  {
    label: "Risk",
    filters: [
      { key: "riskCategory", label: "Category", options: RISK_CATEGORY_OPTIONS },
      { key: "decisioningModel", label: "Model", options: DECISIONING_MODEL_OPTIONS },
    ],
  },
];

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const pathname = usePathname();
  const { currency, toggleCurrency } = useCurrency();
  const {
    period, setPeriod, dateRange, prevDateRange,
    timeRange, setTimeRange, availablePresets,
    comparisonMode, setComparisonMode,
  } = usePeriod();
  const { isDark, toggleTheme } = useTheme();
  const { filters, toggleFilterValue, clearFilter, clearFilters, activeFilterCount } = useFilters();

  // Resolve which filters are visible on this page
  const visibleKeys = getVisibleFilters(pathname);

  // Auto-clear hidden filters when navigating
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      if (visibleKeys !== null) {
        const allKeys: FilterKey[] = [
          "cardType", "productType", "cohort",
          "transactionType", "transactionChannel", "transactionStatus",
          "merchantCategory", "amountRange", "recurringType",
          "riskCategory", "decisioningModel",
        ];
        for (const key of allKeys) {
          if (!visibleKeys.includes(key) && filters[key].length > 0) {
            clearFilter(key);
          }
        }
      }
    }
  }, [pathname, visibleKeys, filters, clearFilter]);

  const totalFilters = visibleKeys === null
    ? activeFilterCount
    : visibleKeys.reduce((sum, key) => sum + filters[key].length, 0);

  const hasAnyFilters = visibleKeys === null || visibleKeys.length > 0;

  const visibleGroups = FILTER_GROUPS
    .map((group) => ({
      ...group,
      filters: group.filters.filter((f) => isFilterVisible(f.key, visibleKeys)),
    }))
    .filter((group) => group.filters.length > 0);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-sm transition-colors",
        isDark
          ? "border-[var(--border)] bg-[var(--background)]/90"
          : "border-[var(--border)] bg-[var(--background)]/95"
      )}
    >
      {/* Row 1: Title + Period + Currency + Theme */}
      <div className="flex items-center gap-2 px-4 py-1.5">
        <h1 className="text-sm font-semibold text-[var(--text-primary)] shrink-0">{title}</h1>

        <div className="flex-1" />

        {/* Period toggle (W/M/Q/Y) */}
        <div className="flex rounded-md bg-[var(--surface-elevated)] p-0.5 shrink-0">
          {CYCLES.map((c) => (
            <button
              key={c.value}
              onClick={() => setPeriod(c.value)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                period === c.value
                  ? isDark ? "bg-[#5B22FF] text-white" : "bg-[#D00083] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-[var(--border)] shrink-0" />

        {/* Currency toggle */}
        <button
          onClick={toggleCurrency}
          className="flex items-center gap-0.5 rounded-md bg-[var(--surface-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] shrink-0"
        >
          <span className={cn(currency === "IDR" && (isDark ? "text-[#7C4DFF] font-bold" : "text-[#D00083] font-bold"))}>IDR</span>
          <span className="text-[var(--border)]">/</span>
          <span className={cn(currency === "USD" && (isDark ? "text-[#7C4DFF] font-bold" : "text-[#D00083] font-bold"))}>USD</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors shrink-0",
            isDark
              ? "bg-[var(--surface-elevated)] text-[#FFD166] hover:bg-[#2D2955]"
              : "bg-[#F0D9F7]/50 text-[#D00083] hover:bg-[#F0D9F7]"
          )}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Row 2: Time range + Date + Comparison + Filters — always visible */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-1 border-t",
        isDark ? "border-[var(--border)]/50 bg-[var(--surface)]/30" : "border-[var(--border)]/50 bg-[var(--surface)]/30"
      )}>
        {/* Time range pills */}
        <div className="flex items-center rounded-md bg-[var(--surface-elevated)] p-0.5 shrink-0">
          {availablePresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setTimeRange(preset.value)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-semibold transition-colors",
                timeRange === preset.value
                  ? isDark ? "bg-[#5B22FF] text-white" : "bg-[#D00083] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Date range chip */}
        <div className="flex items-center gap-1 shrink-0">
          <Calendar className={cn("h-3 w-3", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
          <span className={cn("text-[10px] font-semibold", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")}>
            {dateRange.label}
          </span>
          {comparisonMode !== "none" && (
            <span className="text-[9px] text-[var(--text-muted)]">vs {prevDateRange.label}</span>
          )}
        </div>

        {/* Comparison selector */}
        <div className="relative shrink-0">
          <select
            value={comparisonMode}
            onChange={(e) => setComparisonMode(e.target.value as ComparisonMode)}
            className={cn(
              "appearance-none rounded-md border px-2 py-0.5 pr-5 text-[10px] font-medium cursor-pointer outline-none transition-colors",
              isDark
                ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
            )}
          >
            {COMPARISON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-[var(--text-muted)]" />
        </div>

        {/* Divider before filters */}
        {hasAnyFilters && <div className="h-4 w-px bg-[var(--border)] shrink-0" />}

        {/* Filter dropdowns — always visible, no expand/collapse */}
        {hasAnyFilters && (
          <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
            {visibleGroups.map((group, gi) => (
              <div key={group.label} className="flex items-center gap-1 shrink-0">
                {gi > 0 && <div className="h-4 w-px bg-[var(--border)] mx-0.5 shrink-0" />}
                <span className={cn(
                  "text-[8px] font-bold uppercase tracking-widest shrink-0",
                  isDark ? "text-[var(--text-muted)]/40" : "text-[var(--text-muted)]/50"
                )}>
                  {group.label}
                </span>
                {group.filters.map((f) => (
                  <HeaderFilterDropdown
                    key={f.key}
                    label={f.label}
                    options={f.options}
                    selected={filters[f.key]}
                    onToggle={(v) => toggleFilterValue(f.key, v)}
                    onClear={() => clearFilter(f.key)}
                  />
                ))}
              </div>
            ))}

            {/* Clear all */}
            {totalFilters > 0 && (
              <button
                onClick={() => clearFilters()}
                className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] shrink-0 ml-1"
                aria-label="Reset filters"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
