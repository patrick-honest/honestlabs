"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { usePeriod } from "@/hooks/use-period";
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
import { Sun, Moon, Calendar, SlidersHorizontal, ChevronDown, X } from "lucide-react";
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
  const { currency, toggleCurrency } = useCurrency();
  const { period, setPeriod, periodLabel, dateRange, prevDateRange } = usePeriod();
  const { isDark, toggleTheme } = useTheme();
  const { filters, toggleFilterValue, clearFilter, clearFilters, activeFilterCount } = useFilters();
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const totalFilters = activeFilterCount;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-sm transition-colors",
        isDark
          ? "border-[var(--border)] bg-[var(--background)]/90"
          : "border-[var(--border)] bg-[var(--background)]/95"
      )}
    >
      {/* Single row: title + date + period + filters toggle + currency + theme */}
      <div className="flex items-center gap-2 px-4 py-1.5">
        {/* Title */}
        <h1 className="text-sm font-semibold text-[var(--text-primary)] shrink-0">{title}</h1>

        {/* Date range chip */}
        <div className={cn(
          "flex items-center gap-1 rounded-md px-2 py-0.5 border shrink-0",
          isDark
            ? "border-[var(--border)] bg-[var(--surface)]"
            : "border-[var(--border)] bg-[var(--surface)]"
        )}>
          <Calendar className={cn(
            "h-3 w-3",
            isDark ? "text-[#7C4DFF]" : "text-[#D00083]"
          )} />
          <span className={cn(
            "text-[11px] font-semibold",
            isDark ? "text-[#7C4DFF]" : "text-[#D00083]"
          )}>
            {dateRange.label}
          </span>
          <span className="text-[9px] text-[var(--text-muted)] ml-1">
            vs {prevDateRange.label}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Period toggle */}
        <div className="flex rounded-md bg-[var(--surface-elevated)] p-0.5 shrink-0">
          {CYCLES.map((c) => (
            <button
              key={c.value}
              onClick={() => setPeriod(c.value)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                period === c.value
                  ? isDark
                    ? "bg-[#5B22FF] text-white"
                    : "bg-[#D00083] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-[var(--border)] shrink-0" />

        {/* Filters toggle */}
        <button
          onClick={() => setFiltersExpanded((p) => !p)}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors shrink-0",
            totalFilters > 0
              ? isDark
                ? "bg-[#5B22FF]/15 text-[#7C4DFF] border border-[#5B22FF]/30"
                : "bg-[#D00083]/10 text-[#D00083] border border-[#D00083]/30"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          )}
        >
          <SlidersHorizontal className="h-3 w-3" />
          <span>Filters</span>
          {totalFilters > 0 && (
            <span className={cn(
              "flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white",
              isDark ? "bg-[#5B22FF]" : "bg-[#D00083]"
            )}>
              {totalFilters}
            </span>
          )}
          <ChevronDown className={cn("h-3 w-3 transition-transform", filtersExpanded && "rotate-180")} />
        </button>

        {totalFilters > 0 && (
          <button
            onClick={() => clearFilters()}
            className="text-[var(--text-muted)] hover:text-[var(--danger)] shrink-0"
            aria-label="Clear all filters"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Divider */}
        <div className="h-4 w-px bg-[var(--border)] shrink-0" />

        {/* Currency toggle */}
        <button
          onClick={toggleCurrency}
          className="flex items-center gap-0.5 rounded-md bg-[var(--surface-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] shrink-0"
        >
          <span className={cn(currency === "IDR" && (isDark ? "text-[#7C4DFF] font-bold" : "text-[#D00083] font-bold"))}>
            IDR
          </span>
          <span className="text-[var(--border)]">/</span>
          <span className={cn(currency === "USD" && (isDark ? "text-[#7C4DFF] font-bold" : "text-[#D00083] font-bold"))}>
            USD
          </span>
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

      {/* Expandable filter panel */}
      {filtersExpanded && (
        <div className={cn(
          "border-t px-4 py-2",
          isDark ? "border-[var(--border)] bg-[var(--surface)]/50" : "border-[var(--border)] bg-[var(--surface)]/50"
        )}>
          <div className="flex items-start gap-4">
            {FILTER_GROUPS.map((group, gi) => (
              <div key={group.label} className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-widest shrink-0 w-7",
                  isDark ? "text-[#7C4DFF]/60" : "text-[#D00083]/60"
                )}>
                  {group.label}
                </span>
                <div className="flex flex-wrap gap-1">
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
                {gi < FILTER_GROUPS.length - 1 && (
                  <div className="h-5 w-px bg-[var(--border)] ml-1.5 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
