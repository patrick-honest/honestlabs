"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePeriod, COMPARISON_OPTIONS, type TimeRangePreset, type ComparisonMode, type DateRange } from "@/hooks/use-period";
import { useTheme } from "@/hooks/use-theme";
import {
  useFilters,
  CARD_TYPE_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  COHORT_OPTIONS,
  CYCLE_DATE_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  TRANSACTION_CHANNEL_OPTIONS,
  TRANSACTION_STATUS_OPTIONS,
  MERCHANT_CATEGORY_OPTIONS,
  AMOUNT_RANGE_OPTIONS,
  RECURRING_TYPE_OPTIONS,
  RISK_CATEGORY_OPTIONS,
  DECISIONING_MODEL_OPTIONS,
  type FilterSelections,
  type SavedFilterPreset,
} from "@/hooks/use-filters";
import { HeaderFilterDropdown } from "@/components/filters/header-filter-dropdown";
import { getVisibleFilters, isFilterVisible, type FilterKey } from "@/lib/page-filter-config";
import { Calendar, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, X, Save, Bookmark, Trash2, Pencil, Check } from "lucide-react";
import { useTranslations } from "next-intl";
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

// Filter group definitions — labels are i18n keys resolved at render time
const FILTER_GROUP_DEFS = [
  {
    tKey: "acct" as const,
    filters: [
      { key: "cardType" as const, tKey: "card" as const, options: CARD_TYPE_OPTIONS },
      { key: "productType" as const, tKey: "product" as const, options: PRODUCT_TYPE_OPTIONS },
      { key: "cohort" as const, tKey: "cohort" as const, options: COHORT_OPTIONS },
      { key: "cycleDate" as const, tKey: "cycle" as const, options: CYCLE_DATE_OPTIONS },
    ],
  },
  {
    tKey: "txn" as const,
    filters: [
      { key: "transactionType" as const, tKey: "type" as const, options: TRANSACTION_TYPE_OPTIONS },
      { key: "transactionChannel" as const, tKey: "channel" as const, options: TRANSACTION_CHANNEL_OPTIONS },
      { key: "transactionStatus" as const, tKey: "status" as const, options: TRANSACTION_STATUS_OPTIONS },
      { key: "merchantCategory" as const, tKey: "mcc" as const, options: MERCHANT_CATEGORY_OPTIONS },
      { key: "amountRange" as const, tKey: "amount" as const, options: AMOUNT_RANGE_OPTIONS },
      { key: "recurringType" as const, tKey: "recurring" as const, options: RECURRING_TYPE_OPTIONS },
    ],
  },
  {
    tKey: "riskGroup" as const,
    filters: [
      { key: "riskCategory" as const, tKey: "category" as const, options: RISK_CATEGORY_OPTIONS },
      { key: "decisioningModel" as const, tKey: "model" as const, options: DECISIONING_MODEL_OPTIONS },
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

// Time option definitions — labels are i18n keys resolved at render time
const TIME_OPTION_DEFS: { tKey: string; period: Cycle; timeRange: TimeRangePreset; groupTKey: string }[] = [
  { tKey: "lastFullWeek", period: "weekly", timeRange: "last_full", groupTKey: "weekly" },
  { tKey: "weekToDate", period: "weekly", timeRange: "xtd", groupTKey: "weekly" },
  { tKey: "lastFullMonth", period: "monthly", timeRange: "last_full", groupTKey: "monthly" },
  { tKey: "monthToDate", period: "monthly", timeRange: "xtd", groupTKey: "monthly" },
  { tKey: "lastFullQuarter", period: "quarterly", timeRange: "last_full", groupTKey: "quarterly" },
  { tKey: "quarterToDate", period: "quarterly", timeRange: "xtd", groupTKey: "quarterly" },
  { tKey: "yearToDate", period: "yearly", timeRange: "xtd", groupTKey: "yearly" },
];

// ── Inline Mini Calendar ────────────────────────────────────────────────────

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const DOW_KEYS = ["mo", "tu", "we", "th", "fr", "sa", "su"] as const;

function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < mondayOffset; i++) grid.push(null);
  for (let i = 1; i <= daysInMonth; i++) grid.push(i);
  return grid;
}

function MiniCalendar({
  year, month, selectedStart, selectedEnd, onSelect, onPrev, onNext, isDark, months, dow,
}: {
  year: number; month: number; selectedStart: Date | null; selectedEnd: Date | null;
  onSelect: (d: Date) => void; onPrev: () => void; onNext: () => void; isDark: boolean;
  months: string[]; dow: string[];
}) {
  const grid = getMonthGrid(year, month);
  return (
    <div className="w-[200px]">
      <div className="flex items-center justify-between mb-1.5">
        <button onClick={onPrev} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"><ChevronLeft className="h-3 w-3" /></button>
        <span className="text-[10px] font-semibold text-[var(--text-primary)]">{months[month]} {year}</span>
        <button onClick={onNext} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"><ChevronRight className="h-3 w-3" /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {dow.map((d) => <span key={d} className="text-[7px] font-medium text-[var(--text-muted)] py-0.5">{d}</span>)}
        {grid.map((day, i) => {
          if (day === null) return <span key={`e-${i}`} />;
          const date = new Date(year, month, day);
          const isStart = selectedStart && date.getTime() === selectedStart.getTime();
          const isEnd = selectedEnd && date.getTime() === selectedEnd.getTime();
          const isInRange = selectedStart && selectedEnd && date > selectedStart && date < selectedEnd;
          const isSelected = isStart || isEnd;
          return (
            <button key={day} onClick={() => onSelect(date)} className={cn(
              "h-5 w-5 mx-auto rounded text-[9px] font-medium transition-colors",
              isSelected ? (isDark ? "bg-[#5B22FF] text-white" : "bg-[#D00083] text-white")
                : isInRange ? (isDark ? "bg-[#5B22FF]/15 text-[#7C4DFF]" : "bg-[#D00083]/10 text-[#D00083]")
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
            )}>{day}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── Unified Time Selector ──────────────────────────────────────────────────

function UnifiedTimeSelector({
  period, timeRange, dateRange, prevDateRange, comparisonMode,
  onSelectRange, onComparisonChange, onCustomRange, isDark,
}: {
  period: Cycle;
  timeRange: TimeRangePreset;
  dateRange: DateRange;
  prevDateRange: DateRange;
  comparisonMode: ComparisonMode;
  onSelectRange: (period: Cycle, timeRange: TimeRangePreset) => void;
  onComparisonChange: (mode: ComparisonMode) => void;
  onCustomRange: (start: Date, end: Date) => void;
  isDark: boolean;
}) {
  const tTime = useTranslations("time");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Translated month and day-of-week arrays
  const months = MONTH_KEYS.map((k) => tCommon(`months.${k}`));
  const dow = DOW_KEYS.map((k) => tCommon(`dow.${k}`));

  // Calendar state
  const now = new Date();
  const [leftYear, setLeftYear] = useState(now.getFullYear());
  const [leftMonth, setLeftMonth] = useState(now.getMonth() - 1 < 0 ? 11 : now.getMonth() - 1);
  const [rightYear, setRightYear] = useState(now.getFullYear());
  const [rightMonth, setRightMonth] = useState(now.getMonth());
  const [calStart, setCalStart] = useState<Date | null>(null);
  const [calEnd, setCalEnd] = useState<Date | null>(null);
  const [selecting, setSelecting] = useState<"start" | "end">("start");

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCalendar(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeLabel = (() => {
    const found = TIME_OPTION_DEFS.find((o) => o.period === period && o.timeRange === timeRange);
    return found ? tTime(found.tKey) : tTime("custom");
  })();

  const handleCalSelect = (date: Date) => {
    if (selecting === "start") {
      setCalStart(date);
      if (calEnd && date > calEnd) setCalEnd(date);
      setSelecting("end");
    } else {
      if (date < (calStart ?? date)) {
        setCalStart(date);
        setSelecting("end");
      } else {
        setCalEnd(date);
        setSelecting("start");
      }
    }
  };

  const handleApplyCustom = () => {
    if (calStart && calEnd) {
      onCustomRange(calStart, calEnd);
      setShowCalendar(false);
      setOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Unified range dropdown */}
      <div ref={ref} className="relative">
        <button
          onClick={() => { setOpen(!open); setShowCalendar(false); }}
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

        {open && !showCalendar && (
          <div className={cn(
            "absolute left-0 top-full z-[80] mt-1 w-[280px] rounded-xl border shadow-2xl py-1.5",
            isDark
              ? "border-[var(--border)] bg-[#141226] shadow-black/40"
              : "border-[var(--border)] bg-white shadow-black/10"
          )}>
            {/* Custom range — first option */}
            <button
              onClick={() => {
                setCalStart(dateRange.start);
                setCalEnd(dateRange.end);
                setSelecting("start");
                setShowCalendar(true);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors",
                timeRange === "custom"
                  ? isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/5"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
              )}
            >
              <Calendar className="h-3 w-3" />
              <span className={timeRange === "custom" ? "font-medium" : ""}>{tTime("pickDateRange")}</span>
            </button>

            <div className="border-t border-[var(--border)] mt-1 pt-1 px-2">
              {/* 2-column grid of presets */}
              <div className="grid grid-cols-2 gap-0.5">
                {TIME_OPTION_DEFS.map((opt) => {
                  const isActive = opt.period === period && opt.timeRange === timeRange;
                  return (
                    <button
                      key={`${opt.period}-${opt.timeRange}`}
                      onClick={() => {
                        onSelectRange(opt.period, opt.timeRange);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] transition-colors text-left",
                        isActive
                          ? isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10 font-medium" : "text-[#D00083] bg-[#D00083]/5 font-medium"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
                      )}
                    >
                      {isActive && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isDark ? "bg-[#5B22FF]" : "bg-[#D00083]")} />}
                      {tTime(opt.tKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Calendar picker popup */}
        {open && showCalendar && (
          <div className={cn(
            "absolute left-0 top-full z-[80] mt-1 rounded-xl border shadow-2xl p-3",
            isDark
              ? "border-[var(--border)] bg-[#141226] shadow-black/40"
              : "border-[var(--border)] bg-white shadow-black/10"
          )}>
            <div className="flex gap-3">
              <MiniCalendar
                year={leftYear} month={leftMonth}
                selectedStart={calStart} selectedEnd={calEnd}
                onSelect={handleCalSelect}
                onPrev={() => { if (leftMonth === 0) { setLeftMonth(11); setLeftYear(leftYear - 1); } else setLeftMonth(leftMonth - 1); }}
                onNext={() => { if (leftMonth === 11) { setLeftMonth(0); setLeftYear(leftYear + 1); } else setLeftMonth(leftMonth + 1); }}
                isDark={isDark} months={months} dow={dow}
              />
              <div className="w-px bg-[var(--border)]" />
              <MiniCalendar
                year={rightYear} month={rightMonth}
                selectedStart={calStart} selectedEnd={calEnd}
                onSelect={handleCalSelect}
                onPrev={() => { if (rightMonth === 0) { setRightMonth(11); setRightYear(rightYear - 1); } else setRightMonth(rightMonth - 1); }}
                onNext={() => { if (rightMonth === 11) { setRightMonth(0); setRightYear(rightYear + 1); } else setRightMonth(rightMonth + 1); }}
                isDark={isDark} months={months} dow={dow}
              />
            </div>

            {/* Selected range + actions */}
            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[var(--border)]">
              <div className="text-[10px] text-[var(--text-secondary)]">
                {calStart ? (
                  <span className="font-medium">{calStart.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                ) : <span className="text-[var(--text-muted)]">{tCommon("start")}</span>}
                <span className="text-[var(--text-muted)] mx-1">→</span>
                {calEnd ? (
                  <span className="font-medium">{calEnd.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                ) : <span className="text-[var(--text-muted)]">{tCommon("end")}</span>}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setShowCalendar(false); }}
                  className="rounded px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {tCommon("back")}
                </button>
                <button
                  onClick={handleApplyCustom}
                  disabled={!calStart || !calEnd}
                  className={cn(
                    "rounded px-2.5 py-0.5 text-[10px] font-medium text-white disabled:opacity-40",
                    isDark ? "bg-[#5B22FF]" : "bg-[#D00083]"
                  )}
                >
                  {tCommon("apply")}
                </button>
              </div>
            </div>
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
            <option key={opt.value} value={opt.value}>{tTime(opt.tKey)}</option>
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
  const {
    period, setPeriod, dateRange, prevDateRange,
    timeRange, setTimeRange, availablePresets,
    setPeriodAndRange, comparisonMode, setComparisonMode, setCustomRange,
  } = usePeriod();
  const { isDark } = useTheme();
  const tCommon = useTranslations("common");
  const tTime = useTranslations("time");
  const tFilters = useTranslations("filters");
  const {
    filters, toggleFilterValue, clearFilter, clearFilters, activeFilterCount,
    savedPresets, savePreset, loadPreset, renamePreset, deletePreset, suggestPresetName,
  } = useFilters();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Resolve which filters are visible on this page
  const visibleKeys = getVisibleFilters(pathname);

  // Auto-clear hidden filters when navigating
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      if (visibleKeys !== null) {
        const allKeys: FilterKey[] = [
          "cardType", "productType", "cohort", "cycleDate",
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

  const visibleGroups = FILTER_GROUP_DEFS
    .map((group) => ({
      ...group,
      label: tFilters(group.tKey),
      filters: group.filters
        .filter((f) => isFilterVisible(f.key, visibleKeys))
        .map((f) => ({ ...f, label: tFilters(f.tKey) })),
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
          onCustomRange={setCustomRange}
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
            <span>{tCommon("filters")}</span>
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

      </div>

      {/* Expandable filter panel */}
      {filtersExpanded && hasAnyFilters && (
        <div className={cn(
          "border-t px-4 py-2",
          isDark ? "border-[var(--border)] bg-[var(--surface)]/50" : "border-[var(--border)] bg-[var(--surface)]/50"
        )}>
          {/* Filter dropdowns */}
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

          {/* Saved filter presets bar */}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border)]/50">
            <Bookmark className={cn("h-3 w-3 shrink-0", isDark ? "text-[#7C4DFF]/50" : "text-[#D00083]/50")} />

            {/* Saved preset chips */}
            {savedPresets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-0.5">
                {editingPresetId === preset.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          renamePreset(preset.id, editingName);
                          setEditingPresetId(null);
                        } else if (e.key === "Escape") {
                          setEditingPresetId(null);
                        }
                      }}
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px] w-28 outline-none",
                        isDark ? "border-[#5B22FF]/30 bg-[#141226] text-[var(--text-primary)]" : "border-[#D00083]/30 bg-white text-[var(--text-primary)]"
                      )}
                      autoFocus
                    />
                    <button
                      onClick={() => { renamePreset(preset.id, editingName); setEditingPresetId(null); }}
                      className="text-[var(--success)] hover:opacity-80"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => loadPreset(preset.id)}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                      isDark
                        ? "bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[#5B22FF]/15 hover:text-[#7C4DFF]"
                        : "bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[#D00083]/10 hover:text-[#D00083]"
                    )}
                  >
                    {preset.name}
                  </button>
                )}
                {editingPresetId !== preset.id && (
                  <>
                    <button
                      onClick={() => { setEditingPresetId(preset.id); setEditingName(preset.name); }}
                      className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] opacity-0 group-hover:opacity-100"
                      title="Rename"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                      title="Delete preset"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </>
                )}
              </div>
            ))}

            {/* Save current as preset */}
            {totalFilters > 0 && !showSaveDialog && (
              <button
                onClick={() => { setPresetName(suggestPresetName()); setShowSaveDialog(true); }}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                  isDark
                    ? "text-[#7C4DFF] hover:bg-[#5B22FF]/15 border border-dashed border-[#5B22FF]/30"
                    : "text-[#D00083] hover:bg-[#D00083]/10 border border-dashed border-[#D00083]/30"
                )}
              >
                <Save className="h-2.5 w-2.5" />
                {tCommon("saveFilters")}
              </button>
            )}

            {/* Save dialog inline */}
            {showSaveDialog && (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && presetName.trim()) {
                      savePreset(presetName.trim());
                      setShowSaveDialog(false);
                      setPresetName("");
                    } else if (e.key === "Escape") {
                      setShowSaveDialog(false);
                    }
                  }}
                  placeholder={tCommon("presetName")}
                  className={cn(
                    "rounded border px-2 py-0.5 text-[10px] w-36 outline-none",
                    isDark ? "border-[#5B22FF]/30 bg-[#141226] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" : "border-[#D00083]/30 bg-white text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  )}
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (presetName.trim()) {
                      savePreset(presetName.trim());
                      setShowSaveDialog(false);
                      setPresetName("");
                    }
                  }}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-medium text-white",
                    isDark ? "bg-[#5B22FF]" : "bg-[#D00083]"
                  )}
                >
                  {tCommon("save")}
                </button>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {savedPresets.length === 0 && totalFilters === 0 && (
              <span className="text-[10px] text-[var(--text-muted)] italic">{tCommon("noFiltersHint")}</span>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
