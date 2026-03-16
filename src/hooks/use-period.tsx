"use client";

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import type { Cycle } from "@/types/reports";

interface DateRange {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  label: string;
}

interface PeriodContextValue {
  period: Cycle;
  setPeriod: (p: Cycle) => void;
  periodLabel: string;
  dateRange: DateRange;
  prevDateRange: DateRange;
}

const TODAY = new Date(2026, 2, 16); // Mar 16, 2026

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function computeDateRange(period: Cycle): { current: DateRange; previous: DateRange } {
  const today = TODAY;

  switch (period) {
    case "weekly": {
      // Current week: Mon–Sun containing today
      const dayOfWeek = today.getDay(); // 0=Sun
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const start = new Date(today);
      start.setDate(today.getDate() + mondayOffset);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const prevStart = new Date(start);
      prevStart.setDate(start.getDate() - 7);
      const prevEnd = new Date(start);
      prevEnd.setDate(start.getDate() - 1);

      return {
        current: {
          start,
          end,
          startStr: formatDate(start),
          endStr: formatDate(end),
          label: `${formatDateShort(start)} – ${formatDateShort(end)}, ${end.getFullYear()}`,
        },
        previous: {
          start: prevStart,
          end: prevEnd,
          startStr: formatDate(prevStart),
          endStr: formatDate(prevEnd),
          label: `${formatDateShort(prevStart)} – ${formatDateShort(prevEnd)}, ${prevEnd.getFullYear()}`,
        },
      };
    }
    case "monthly": {
      // Current month
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0);

      return {
        current: {
          start,
          end,
          startStr: formatDate(start),
          endStr: formatDate(end),
          label: `${formatDateShort(start)} – ${formatDateShort(end)}, ${end.getFullYear()}`,
        },
        previous: {
          start: prevStart,
          end: prevEnd,
          startStr: formatDate(prevStart),
          endStr: formatDate(prevEnd),
          label: `${formatDateShort(prevStart)} – ${formatDateShort(prevEnd)}, ${prevEnd.getFullYear()}`,
        },
      };
    }
    case "quarterly": {
      // Current quarter
      const q = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), q * 3, 1);
      const end = new Date(today.getFullYear(), q * 3 + 3, 0);

      const prevStart = new Date(today.getFullYear(), q * 3 - 3, 1);
      const prevEnd = new Date(today.getFullYear(), q * 3, 0);

      const qLabel = `Q${q + 1} ${today.getFullYear()}`;
      const prevQ = q === 0 ? 4 : q;
      const prevYear = q === 0 ? today.getFullYear() - 1 : today.getFullYear();
      const prevQLabel = `Q${prevQ} ${prevYear}`;

      return {
        current: {
          start,
          end,
          startStr: formatDate(start),
          endStr: formatDate(end),
          label: `${qLabel}: ${formatDateShort(start)} – ${formatDateShort(end)}`,
        },
        previous: {
          start: prevStart,
          end: prevEnd,
          startStr: formatDate(prevStart),
          endStr: formatDate(prevEnd),
          label: `${prevQLabel}: ${formatDateShort(prevStart)} – ${formatDateShort(prevEnd)}`,
        },
      };
    }
    case "yearly": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);

      const prevStart = new Date(today.getFullYear() - 1, 0, 1);
      const prevEnd = new Date(today.getFullYear() - 1, 11, 31);

      return {
        current: {
          start,
          end,
          startStr: formatDate(start),
          endStr: formatDate(end),
          label: `Jan 1 – Dec 31, ${today.getFullYear()}`,
        },
        previous: {
          start: prevStart,
          end: prevEnd,
          startStr: formatDate(prevStart),
          endStr: formatDate(prevEnd),
          label: `Jan 1 – Dec 31, ${today.getFullYear() - 1}`,
        },
      };
    }
  }
}

const PERIOD_LABELS: Record<Cycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const PeriodContext = createContext<PeriodContextValue | undefined>(undefined);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Cycle>("weekly");

  const { current, previous } = useMemo(() => computeDateRange(period), [period]);

  const periodLabel = PERIOD_LABELS[period];

  return (
    <PeriodContext.Provider
      value={{ period, setPeriod, periodLabel, dateRange: current, prevDateRange: previous }}
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
