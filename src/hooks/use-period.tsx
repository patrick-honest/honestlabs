"use client";

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react";
import type { Cycle } from "@/types/reports";

// ── Types ────────────────────────────────────────────────────────────

export interface DateRange {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  label: string;
}

/**
 * Time range presets per period type.
 *
 *  xtd         — "to date" (WTD / MTD / QTD / YTD)  ← default on load
 *  last_full   — Last full fiscal period (Last FW / Last FM / Last FQ / Last FY)
 *  full        — Full current period
 *  custom      — User-defined date range via calendar picker
 */
export type TimeRangePreset = "xtd" | "last_full" | "full" | "custom";

/**
 * Comparison modes.
 *
 *  prior_period  — Previous equivalent period (default)
 *  prior_year    — Same period one year ago
 *  none          — No comparison
 */
export type ComparisonMode = "prior_period" | "prior_year" | "none";

interface PeriodContextValue {
  period: Cycle;
  setPeriod: (p: Cycle) => void;
  periodLabel: string;
  dateRange: DateRange;
  prevDateRange: DateRange;
  /** Current time range preset */
  timeRange: TimeRangePreset;
  setTimeRange: (tr: TimeRangePreset) => void;
  /** Available quick range presets for the active period */
  availablePresets: { value: TimeRangePreset; label: string }[];
  /** Set both period and time range together (for unified selector) */
  setPeriodAndRange: (p: Cycle, tr: TimeRangePreset) => void;
  /** Comparison mode */
  comparisonMode: ComparisonMode;
  setComparisonMode: (m: ComparisonMode) => void;
  /** Set a custom date range (switches timeRange to "custom") */
  setCustomRange: (start: Date, end: Date) => void;
  /**
   * Multiplier (0-1) representing what fraction of the full period
   * is covered by the current time range. Use to scale mock data.
   * - "full" / "last_full" = 1.0 (complete period)
   * - "xtd" = fraction of period elapsed (e.g. Monday of a week = 1/7)
   */
  timeRangeMultiplier: number;
}

// ── Constants ────────────────────────────────────────────────────────

export const TODAY = new Date(2026, 2, 16); // Mar 16, 2026 (Monday)

/** User-friendly preset labels per period type */
const PRESET_LABELS: Record<Cycle, Record<TimeRangePreset, string>> = {
  weekly:    { xtd: "WTD",  last_full: "Last FW", full: "Full Week", custom: "Custom" },
  monthly:   { xtd: "MTD",  last_full: "Last FM", full: "Full Month", custom: "Custom" },
  quarterly: { xtd: "QTD",  last_full: "Last FQ", full: "Full Quarter", custom: "Custom" },
  yearly:    { xtd: "YTD",  last_full: "Last FY", full: "Full Year", custom: "Custom" },
};

/**
 * Ordered preset list per period.
 * Weekly puts "Last FW" first per user request.
 * "custom" is not listed here — it's handled by the calendar picker in the UI.
 */
const PRESET_ORDER: Record<Cycle, TimeRangePreset[]> = {
  weekly:    ["last_full", "xtd", "full"],
  monthly:   ["xtd", "last_full", "full"],
  quarterly: ["xtd", "last_full", "full"],
  yearly:    ["xtd", "last_full", "full"],
};

const COMPARISON_OPTIONS: { value: ComparisonMode; label: string }[] = [
  { value: "prior_period", label: "vs Prior Period" },
  { value: "prior_year",   label: "vs Prior Year" },
  { value: "none",         label: "No Comparison" },
];

export { COMPARISON_OPTIONS };

const PERIOD_LABELS: Record<Cycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

// ── Date helpers ─────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function makeDateRange(start: Date, end: Date): DateRange {
  const sameYear = start.getFullYear() === end.getFullYear();
  const label = sameYear
    ? `${formatDateShort(start)} – ${formatDateShort(end)}, ${end.getFullYear()}`
    : `${formatDate(start)} – ${formatDate(end)}`;
  return {
    start,
    end,
    startStr: formatDate(start),
    endStr: formatDate(end),
    label,
  };
}

/** Get Monday of the week containing `d` (ISO weeks: Mon = first day). */
function getMonday(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay(); // 0=Sun
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  return result;
}

// ── Date range computation ───────────────────────────────────────────

function computeRanges(
  period: Cycle,
  timeRange: TimeRangePreset,
  comparisonMode: ComparisonMode,
): { current: DateRange; previous: DateRange } {
  const today = TODAY;

  let currentStart: Date;
  let currentEnd: Date;

  // ── Compute current range based on period + timeRange ──
  switch (period) {
    case "weekly": {
      const weekStart = getMonday(today);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      if (timeRange === "xtd") {
        // WTD: Monday of current week → today
        currentStart = weekStart;
        currentEnd = new Date(today);
      } else if (timeRange === "last_full") {
        // Last FW: previous full Mon–Sun
        currentStart = new Date(weekStart);
        currentStart.setDate(weekStart.getDate() - 7);
        currentEnd = new Date(weekStart);
        currentEnd.setDate(weekStart.getDate() - 1);
      } else {
        // Full week
        currentStart = weekStart;
        currentEnd = weekEnd;
      }
      break;
    }
    case "monthly": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      if (timeRange === "xtd") {
        // MTD: 1st of month → today
        currentStart = monthStart;
        currentEnd = new Date(today);
      } else if (timeRange === "last_full") {
        // Last FM: previous full month
        currentStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        currentEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      } else {
        currentStart = monthStart;
        currentEnd = monthEnd;
      }
      break;
    }
    case "quarterly": {
      const q = Math.floor(today.getMonth() / 3);
      const qStart = new Date(today.getFullYear(), q * 3, 1);
      const qEnd = new Date(today.getFullYear(), q * 3 + 3, 0);

      if (timeRange === "xtd") {
        // QTD: quarter start → today
        currentStart = qStart;
        currentEnd = new Date(today);
      } else if (timeRange === "last_full") {
        // Last FQ: previous full quarter
        currentStart = new Date(today.getFullYear(), q * 3 - 3, 1);
        currentEnd = new Date(today.getFullYear(), q * 3, 0);
      } else {
        currentStart = qStart;
        currentEnd = qEnd;
      }
      break;
    }
    case "yearly": {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const yearEnd = new Date(today.getFullYear(), 11, 31);

      if (timeRange === "xtd") {
        // YTD: Jan 1 → today
        currentStart = yearStart;
        currentEnd = new Date(today);
      } else if (timeRange === "last_full") {
        // Last FY: previous full year
        currentStart = new Date(today.getFullYear() - 1, 0, 1);
        currentEnd = new Date(today.getFullYear() - 1, 11, 31);
      } else {
        currentStart = yearStart;
        currentEnd = yearEnd;
      }
      break;
    }
  }

  // ── Compute comparison range ──
  let prevStart: Date;
  let prevEnd: Date;

  if (comparisonMode === "none") {
    // No comparison — set prev to same as current (hidden in UI)
    prevStart = currentStart;
    prevEnd = currentEnd;
  } else if (comparisonMode === "prior_year") {
    // Same dates, one year earlier
    prevStart = new Date(currentStart);
    prevStart.setFullYear(prevStart.getFullYear() - 1);
    prevEnd = new Date(currentEnd);
    prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  } else {
    // prior_period: shift back by one period length
    const spanMs = currentEnd.getTime() - currentStart.getTime();
    const spanDays = Math.round(spanMs / (1000 * 60 * 60 * 24));

    switch (period) {
      case "weekly": {
        // Shift back 7 days
        prevStart = new Date(currentStart);
        prevStart.setDate(prevStart.getDate() - 7);
        prevEnd = new Date(currentEnd);
        prevEnd.setDate(prevEnd.getDate() - 7);
        break;
      }
      case "monthly": {
        // Shift back 1 month, same day-of-month range
        prevStart = new Date(currentStart);
        prevStart.setMonth(prevStart.getMonth() - 1);
        prevEnd = new Date(currentEnd);
        prevEnd.setMonth(prevEnd.getMonth() - 1);
        // Clamp to end of previous month if needed
        const prevMonthEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0);
        if (prevEnd > prevMonthEnd && timeRange === "xtd") {
          prevEnd = prevMonthEnd;
        }
        break;
      }
      case "quarterly": {
        // Shift back 3 months
        prevStart = new Date(currentStart);
        prevStart.setMonth(prevStart.getMonth() - 3);
        prevEnd = new Date(currentEnd);
        prevEnd.setMonth(prevEnd.getMonth() - 3);
        break;
      }
      case "yearly": {
        // Shift back 1 year
        prevStart = new Date(currentStart);
        prevStart.setFullYear(prevStart.getFullYear() - 1);
        prevEnd = new Date(currentEnd);
        prevEnd.setFullYear(prevEnd.getFullYear() - 1);
        break;
      }
    }
  }

  // ── Build labels ──
  const current = makeDateRange(currentStart, currentEnd);

  // For quarterly ranges, add Q label prefix
  if (period === "quarterly") {
    const q = Math.floor(currentStart.getMonth() / 3) + 1;
    current.label = `Q${q} ${currentStart.getFullYear()}: ${formatDateShort(currentStart)} – ${formatDateShort(currentEnd)}`;
  }

  const previous = makeDateRange(prevStart, prevEnd);
  if (period === "quarterly" && comparisonMode !== "none") {
    const pq = Math.floor(prevStart.getMonth() / 3) + 1;
    previous.label = `Q${pq} ${prevStart.getFullYear()}: ${formatDateShort(prevStart)} – ${formatDateShort(prevEnd)}`;
  }

  return { current, previous };
}

// ── Context ──────────────────────────────────────────────────────────

const PeriodContext = createContext<PeriodContextValue | undefined>(undefined);

const PERIOD_STORAGE_KEY = "honest_period_prefs";

interface PeriodPrefs {
  period: Cycle;
  timeRange: TimeRangePreset;
  comparisonMode: ComparisonMode;
  customStart?: string; // ISO date for custom range
  customEnd?: string;
}

function loadPeriodPrefs(): PeriodPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PERIOD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePeriodPrefs(period: Cycle, timeRange: TimeRangePreset, comparisonMode: ComparisonMode, customStart?: string, customEnd?: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify({ period, timeRange, comparisonMode, customStart, customEnd })); }
  catch { /* ignore */ }
}

export function PeriodProvider({ children }: { children: ReactNode }) {
  const saved = loadPeriodPrefs();
  const [period, setPeriodRaw] = useState<Cycle>(saved?.period ?? "weekly");
  const [timeRange, setTimeRangeRaw] = useState<TimeRangePreset>(saved?.timeRange ?? "last_full");
  const [comparisonMode, setComparisonModeRaw] = useState<ComparisonMode>(saved?.comparisonMode ?? "prior_period");
  const [customStart, setCustomStart] = useState<Date | null>(
    saved?.customStart ? new Date(saved.customStart + "T00:00:00") : null,
  );
  const [customEnd, setCustomEnd] = useState<Date | null>(
    saved?.customEnd ? new Date(saved.customEnd + "T00:00:00") : null,
  );

  // Persist selections to localStorage
  const setTimeRange = useCallback((tr: TimeRangePreset) => {
    setTimeRangeRaw(tr);
    savePeriodPrefs(period, tr, comparisonMode);
  }, [period, comparisonMode]);

  const setComparisonMode = useCallback((cm: ComparisonMode) => {
    setComparisonModeRaw(cm);
    savePeriodPrefs(period, timeRange, cm, customStart ? toIsoDate(customStart) : undefined, customEnd ? toIsoDate(customEnd) : undefined);
  }, [period, timeRange, customStart, customEnd]);

  // When switching period alone, default to last_full
  const setPeriod = useCallback((p: Cycle) => {
    setPeriodRaw(p);
    setTimeRangeRaw("last_full");
    savePeriodPrefs(p, "last_full", comparisonMode);
  }, [comparisonMode]);

  // Set both period and time range together (for unified selector)
  const setPeriodAndRange = useCallback((p: Cycle, tr: TimeRangePreset) => {
    setPeriodRaw(p);
    setTimeRangeRaw(tr);
    savePeriodPrefs(p, tr, comparisonMode);
  }, [comparisonMode]);

  // Set a custom date range
  const setCustomRange = useCallback((start: Date, end: Date) => {
    setCustomStart(start);
    setCustomEnd(end);
    setTimeRangeRaw("custom");
    // Keep period as-is for labeling purposes
    savePeriodPrefs(period, "custom", comparisonMode, toIsoDate(start), toIsoDate(end));
  }, [period, comparisonMode]);

  const { current, previous } = useMemo(() => {
    // For custom range, build the date range directly
    if (timeRange === "custom" && customStart && customEnd) {
      const currentRange = makeDateRange(customStart, customEnd);
      // For comparison, shift back by the same span
      const spanMs = customEnd.getTime() - customStart.getTime();
      const prevStart = new Date(customStart.getTime() - spanMs - 86400000); // -1 day gap
      const prevEnd = new Date(customStart.getTime() - 86400000);
      const previousRange = makeDateRange(prevStart, prevEnd);
      return { current: currentRange, previous: previousRange };
    }
    return computeRanges(period, timeRange, comparisonMode);
  }, [period, timeRange, comparisonMode, customStart, customEnd]);

  const periodLabel = PERIOD_LABELS[period];

  const availablePresets = useMemo(
    () => PRESET_ORDER[period].map((preset) => ({
      value: preset,
      label: PRESET_LABELS[period][preset],
    })),
    [period],
  );

  // Compute what fraction of a full period the current range covers
  const timeRangeMultiplier = useMemo(() => {
    if (timeRange === "custom") return 1; // Custom ranges are treated as full
    if (timeRange === "full" || timeRange === "last_full") return 1;
    // "xtd" — fraction of period elapsed
    const today = TODAY;
    switch (period) {
      case "weekly": {
        const dayOfWeek = today.getDay();
        const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek; // Mon=1, Sun=7
        return dayNum / 7;
      }
      case "monthly": {
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        return today.getDate() / daysInMonth;
      }
      case "quarterly": {
        const qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
        const qEnd = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 3, 0);
        const totalDays = (qEnd.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
        const elapsed = (today.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
        return elapsed / totalDays;
      }
      case "yearly": {
        const yearStart = new Date(today.getFullYear(), 0, 1);
        const yearEnd = new Date(today.getFullYear(), 11, 31);
        const totalDays = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
        const elapsed = (today.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
        return elapsed / totalDays;
      }
    }
  }, [period, timeRange]);

  return (
    <PeriodContext.Provider
      value={{
        period,
        setPeriod,
        periodLabel,
        dateRange: current,
        prevDateRange: previous,
        timeRange,
        setTimeRange,
        availablePresets,
        setPeriodAndRange,
        comparisonMode,
        setComparisonMode,
        setCustomRange,
        timeRangeMultiplier,
      }}
    >
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod must be used within PeriodProvider");
  return ctx;
}

/** Convert a Date to YYYY-MM-DD string for API query parameters. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Build a URL query string suffix with the current period's date range.
 * Returns e.g. "startDate=2026-03-10&endDate=2026-03-16&period=weekly"
 *
 * Usage in SWR:
 *   const { dateParams } = useDateParams();
 *   useSWR(`/api/spend-analysis?${dateParams}`, fetcher);
 *
 * When the user changes the time selector, dateParams changes → SWR refetches.
 */
export function useDateParams(): {
  dateParams: string;
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
} {
  const { period, dateRange, prevDateRange } = usePeriod();
  return useMemo(() => {
    const startDate = toIsoDate(dateRange.start);
    const endDate = toIsoDate(dateRange.end);
    const prevStartDate = toIsoDate(prevDateRange.start);
    const prevEndDate = toIsoDate(prevDateRange.end);
    return {
      dateParams: `startDate=${startDate}&endDate=${endDate}&period=${period}`,
      startDate,
      endDate,
      prevStartDate,
      prevEndDate,
    };
  }, [period, dateRange, prevDateRange]);
}
