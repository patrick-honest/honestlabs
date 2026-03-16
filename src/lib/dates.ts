import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subWeeks, subMonths, subQuarters, subYears, startOfYear, endOfYear } from "date-fns";

export const TIMEZONE = "Asia/Jakarta";

export type Cycle = "weekly" | "monthly" | "quarterly" | "yearly";

export function getCurrentPeriod(cycle: Cycle): { start: Date; end: Date } {
  const now = new Date();
  switch (cycle) {
    case "weekly":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "monthly":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "quarterly":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "yearly":
      return { start: startOfYear(now), end: endOfYear(now) };
  }
}

export function getPreviousPeriod(cycle: Cycle, start: Date): { start: Date; end: Date } {
  switch (cycle) {
    case "weekly": {
      const prev = subWeeks(start, 1);
      return { start: prev, end: endOfWeek(prev, { weekStartsOn: 1 }) };
    }
    case "monthly": {
      const prev = subMonths(start, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case "quarterly": {
      const prev = subQuarters(start, 1);
      return { start: startOfQuarter(prev), end: endOfQuarter(prev) };
    }
    case "yearly": {
      const prev = subYears(start, 1);
      return { start: startOfYear(prev), end: endOfYear(prev) };
    }
  }
}

export function formatPeriodLabel(cycle: Cycle, start: Date): string {
  switch (cycle) {
    case "weekly":
      return `Week of ${format(start, "MMM d, yyyy")}`;
    case "monthly":
      return format(start, "MMMM yyyy");
    case "quarterly": {
      const q = Math.floor(start.getMonth() / 3) + 1;
      return `Q${q} ${format(start, "yyyy")}`;
    }
    case "yearly":
      return format(start, "yyyy");
  }
}

export function formatDateShort(date: Date): string {
  return format(date, "MMM d");
}

export function formatDateFull(date: Date): string {
  return format(date, "MMM d, yyyy");
}

export function toSqlDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
