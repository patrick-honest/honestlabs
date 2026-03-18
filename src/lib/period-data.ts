/**
 * Shared utility for generating period-aware mock data.
 * When real API data is connected, this file can be replaced
 * with actual data fetching logic.
 */
import type { Cycle } from "@/types/reports";

/** Period-aware date labels for x-axes */
export function getPeriodLabels(period: Cycle): string[] {
  switch (period) {
    case "weekly":
      // Past 6 weeks (one data point per week)
      return ["Feb 2", "Feb 9", "Feb 16", "Feb 23", "Mar 2", "Mar 9"];
    case "monthly":
      return ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    case "quarterly":
      return ["Q3 2025", "Q4 2025", "Q1 2026"];
    case "yearly":
      return ["2023", "2024", "2025", "2026 YTD"];
  }
}

/** Period-aware data range display string */
export function getPeriodRange(period: Cycle): { start: string; end: string } {
  switch (period) {
    case "weekly":
      return { start: "Feb 2, 2026", end: "Mar 15, 2026" };
    case "monthly":
      return { start: "Mar 1, 2026", end: "Mar 16, 2026" };
    case "quarterly":
      return { start: "Jan 1, 2026", end: "Mar 16, 2026" };
    case "yearly":
      return { start: "Jan 1, 2026", end: "Mar 16, 2026" };
  }
}

/** Scale multiplier for absolute numbers */
export function getScaleMultiplier(period: Cycle): number {
  switch (period) {
    case "weekly":
      return 0.25;
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "yearly":
      return 12;
  }
}

/**
 * Generates period-aware trend data from base monthly values.
 * Interpolates the base array to match the period's label count.
 */
export function scaleTrendData<T extends Record<string, unknown>>(
  baseData: T[],
  period: Cycle,
  dateKey: string = "date",
): T[] {
  const labels = getPeriodLabels(period);
  const numericKeys = Object.keys(baseData[0]).filter((k) => k !== dateKey && typeof baseData[0][k] === "number");

  // Interpolate base data to match label count
  return labels.map((label, i) => {
    const srcIdx = Math.min(
      Math.floor((i / Math.max(labels.length - 1, 1)) * (baseData.length - 1)),
      baseData.length - 1
    );
    const srcItem = baseData[srcIdx];

    const item: Record<string, unknown> = { [dateKey]: label };
    for (const key of numericKeys) {
      const baseVal = srcItem[key] as number;
      // Add small variance per period so data looks different
      const variance = 1 + (period === "weekly" ? -0.05 : period === "quarterly" ? 0.03 : period === "yearly" ? 0.08 : 0);
      item[key] = key.includes("rate") || key.includes("percent") || key.includes("Rate")
        ? +(baseVal * variance).toFixed(1)
        : Math.round(baseVal * variance);
    }
    return item as T;
  });
}

/** Period-aware labels for use in analysis bullets and insights */
export interface PeriodInsightLabels {
  /** e.g. "6 weeks", "6 months", "3 quarters", "4 years" */
  span: string;
  /** e.g. "WoW", "MoM", "QoQ", "YoY" */
  changeAbbrev: string;
  /** e.g. "week-over-week", "month-over-month" */
  changeFull: string;
  /** e.g. "week", "month", "quarter", "year" */
  unit: string;
  /** e.g. "weekly", "monthly", "quarterly", "yearly" */
  adjective: string;
  /** First label in the period, e.g. "Feb 2" or "Oct" */
  firstLabel: string;
  /** Last label in the period, e.g. "Mar 9" or "Mar" */
  lastLabel: string;
  /** e.g. "trailing 6-week window", "trailing 6-month window" */
  trailingWindow: string;
  /** Number of data points */
  pointCount: number;
  /** Previous period reference, e.g. "previous 6 weeks", "previous 6 months" */
  prevPeriod: string;
}

export function getPeriodInsightLabels(period: Cycle): PeriodInsightLabels {
  const labels = getPeriodLabels(period);
  const first = labels[0];
  const last = labels[labels.length - 1];

  switch (period) {
    case "weekly":
      return {
        span: "6 weeks",
        changeAbbrev: "WoW",
        changeFull: "week-over-week",
        unit: "week",
        adjective: "weekly",
        firstLabel: first,
        lastLabel: last,
        trailingWindow: "trailing 6-week window",
        pointCount: labels.length,
        prevPeriod: "previous 6 weeks",
      };
    case "monthly":
      return {
        span: "6 months",
        changeAbbrev: "MoM",
        changeFull: "month-over-month",
        unit: "month",
        adjective: "monthly",
        firstLabel: first,
        lastLabel: last,
        trailingWindow: "trailing 6-month window",
        pointCount: labels.length,
        prevPeriod: "previous 6 months",
      };
    case "quarterly":
      return {
        span: "3 quarters",
        changeAbbrev: "QoQ",
        changeFull: "quarter-over-quarter",
        unit: "quarter",
        adjective: "quarterly",
        firstLabel: first,
        lastLabel: last,
        trailingWindow: "trailing 3-quarter window",
        pointCount: labels.length,
        prevPeriod: "previous 3 quarters",
      };
    case "yearly":
      return {
        span: "4 years",
        changeAbbrev: "YoY",
        changeFull: "year-over-year",
        unit: "year",
        adjective: "yearly",
        firstLabel: first,
        lastLabel: last,
        trailingWindow: "trailing 4-year window",
        pointCount: labels.length,
        prevPeriod: "previous 4 years",
      };
  }
}

/**
 * Scales a single metric value based on period.
 * Rates stay roughly the same; absolute counts scale.
 */
/**
 * Scales a single metric value based on period and optional time range fraction.
 * @param timeRangeFraction 0-1 multiplier for partial period (e.g. WTD on Monday = 1/7).
 *   Defaults to 1 (full period). Only applies to absolute values, not rates.
 */
export function scaleMetricValue(value: number, period: Cycle, isRate: boolean, timeRangeFraction: number = 1): number {
  if (isRate) {
    // Rates don't scale with time range — but slight variance by period
    const offsets: Record<Cycle, number> = { weekly: -1.2, monthly: 0, quarterly: 0.5, yearly: -0.8 };
    return +(value + offsets[period]).toFixed(1);
  }
  return Math.round(value * getScaleMultiplier(period) * timeRangeFraction);
}
