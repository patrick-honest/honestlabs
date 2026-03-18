"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { usePeriod, COMPARISON_OPTIONS, type TimeRangePreset, type ComparisonMode, type DateRange } from "@/hooks/use-period";
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
import { Sun, Moon, Calendar, SlidersHorizontal, ChevronDown, X } from "lucide-react";
import type { Cycle } from "@/types/reports";
// Types already imported above from use-period

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

// ── Unified Time Range Selector ──────────────────────────────────────────────

interface TimeOption {
  label: string;
  period: Cycle;
  timeRange: TimeRangePreset;
  group: string;
}

const TIME_OPTIONS: TimeOption[] = [
  { label: "Last Full Week", period: "weekly", timeRange: "last_full", group: "Weekly" },
  { label: "Week to Date", period: "weekly", timeRange: "xtd", group: "Weekly" },
  { label: "Last Full Month", period: "monthly", timeRange: "last_full", group: "Monthly" },
  { label: "Month to Date", period: "monthly", timeRange: "xtd", group: "Monthly" },
  { label: "Last Full Quarter", period: "quarterly", timeRange: "last_full", group: "Quarterly" },
  { label: "Quarter to Date", period: "quarterly", timeRange: "xtd", group: "Quarterly" },
  { label: "Year to Date", period: "yearly", timeRange: "xtd", group: "Yearly" },
];

function getActiveLabel(period: Cycle, timeRange: TimeRangePreset): string {
  const found = TIME_OPTIONS.find((o) => o.period === period && o.timeRange === timeRange);
  return found?.label ?? "Custom";
}

function UnifiedTimeSelector({
  period, timeRange, dateRange, prevDateRange, comparisonMode,
  onSelectRange, onComparisonChange, isDark,
}: {
  period: Cycle;
  timeRange: TimeRangePreset;
  dateRange: DateRange;
  prevDateRange: DateRange;
  comparisonMode: ComparisonMode;
  onSelectRange: (period: Cycle, timeRange: TimeRangePreset) => void;
  onComparisonChange: (mode: ComparisonMode) => void;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeLabel = getActiveLabel(period, timeRange);

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Unified range dropdown */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
            isDark
              ? "border-[#5B22FF]/40 bg-[#5B22FF]/10 text-[#7C4DFF]"
              : "border-[#D00083]/30 bg-[#D00083]/5 text-[#D00083]"
          )}
        >
          <Calendar className="h-3 w-3" />
          <span>{activeLabel}</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className={cn(
            "absolute left-0 top-full z-[80] mt-1 w-56 rounded-xl border shadow-2xl py-1",
            isDark
              ? "border-[var(--border)] bg-[#141226] shadow-black/40"
              : "border-[var(--border)] bg-white shadow-black/10"
          )}>
            {TIME_OPTIONS.map((opt, idx) => {
              const showGroup = idx === 0 || TIME_OPTIONS[idx - 1].group !== opt.group;
              const isActive = opt.period === period && opt.timeRange === timeRange;
              return (
                <div key={`${opt.period}-${opt.timeRange}`}>
                  {showGroup && (
                    <div className={cn(
                      "px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest",
                      idx > 0 && "border-t border-[var(--border)] mt-1",
                      "text-[var(--text-muted)]"
                    )}>
                      {opt.group}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      onSelectRange(opt.period, opt.timeRange);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors",
                      isActive
                        ? isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/5"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
                    )}
                  >
                    {isActive && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isDark ? "bg-[#5B22FF]" : "bg-[#D00083]")} />}
                    <span className={isActive ? "font-medium" : ""}>{opt.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Date range display */}
      <div className="flex items-center gap-1 text-[10px]">
        <span className={cn("font-semibold", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")}>
          {dateRange.label}
        </span>
        {comparisonMode !== "none" && (
          <span className="text-[var(--text-muted)]">vs {prevDateRange.label}</span>
        )}
      </div>

      {/* Comparison mode */}
      <div className="relative shrink-0">
        <select
          value={comparisonMode}
          onChange={(e) => onComparisonChange(e.target.value as ComparisonMode)}
          className={cn(
            "appearance-none rounded-md border px-1.5 py-0.5 pr-4 text-[10px] font-medium cursor-pointer outline-none transition-colors",
            isDark
              ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
          )}
        >
          {COMPARISON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-[var(--text-muted)]" />
      </div>
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const pathname = usePathname();
  const { currency, toggleCurrency } = useCurrency();
  const {
    period, setPeriod, dateRange, prevDateRange,
    timeRange, setTimeRange, availablePresets,
    setPeriodAndRange, comparisonMode, setComparisonMode,
  } = usePeriod();
  const { isDark, toggleTheme } = useTheme();
  const { filters, toggleFilterValue, clearFilter, clearFilters, activeFilterCount } = useFilters();
  const [filtersExpanded, setFiltersExpanded] = useState(false);

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
      {/* Main row: title + time controls + filters + settings */}
      <div className="flex items-center gap-2 px-4 py-1.5">
        {/* Title */}
        <h1 className="text-sm font-semibold text-[var(--text-primary)] shrink-0">{title}</h1>

        {/* ── Unified time range dropdown + date + comparison ── */}
        <UnifiedTimeSelector
          period={period}
          timeRange={timeRange}
          dateRange={dateRange}
          prevDateRange={prevDateRange}
          comparisonMode={comparisonMode}
          onSelectRange={setPeriodAndRange}
          onComparisonChange={setComparisonMode}
          isDark={isDark}
        />

        {/* Spacer */}
        <div className="flex-1" />

        <div className="h-4 w-px bg-[var(--border)] shrink-0" />

        {/* Filters toggle */}
        {hasAnyFilters && (
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
        )}

        {totalFilters > 0 && (
          <button
            onClick={() => clearFilters()}
            className="text-[var(--text-muted)] hover:text-[var(--danger)] shrink-0"
            aria-label="Reset filters"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

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

      {/* Expandable filter panel */}
      {filtersExpanded && hasAnyFilters && (
        <div className={cn(
          "border-t px-4 py-2",
          isDark ? "border-[var(--border)] bg-[var(--surface)]/50" : "border-[var(--border)] bg-[var(--surface)]/50"
        )}>
          <div className="flex items-start gap-4">
            {visibleGroups.map((group, gi) => (
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
                {gi < visibleGroups.length - 1 && (
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
