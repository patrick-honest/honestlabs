"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Cycle } from "@/types/reports";

interface PeriodContextValue {
  period: Cycle;
  setPeriod: (p: Cycle) => void;
  periodLabel: string;
}

const PERIOD_LABELS: Record<Cycle, string> = {
  weekly: "This Week",
  monthly: "This Month",
  quarterly: "This Quarter",
  yearly: "This Year",
};

const PeriodContext = createContext<PeriodContextValue | undefined>(undefined);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Cycle>("monthly");

  const periodLabel = PERIOD_LABELS[period];

  return (
    <PeriodContext.Provider value={{ period, setPeriod, periodLabel }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod must be used within PeriodProvider");
  return ctx;
}
