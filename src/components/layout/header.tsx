"use client";

import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { usePeriod } from "@/hooks/use-period";
import type { Cycle } from "@/types/reports";

const CYCLES: { value: Cycle; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { currency, toggleCurrency } = useCurrency();
  const { period, setPeriod, periodLabel } = usePeriod();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
          {periodLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Period toggle */}
        <div className="flex rounded-lg bg-slate-800 p-0.5">
          {CYCLES.map((c) => (
            <button
              key={c.value}
              onClick={() => setPeriod(c.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                period === c.value
                  ? "bg-blue-500 text-white"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Currency toggle */}
        <button
          onClick={toggleCurrency}
          className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-white"
        >
          <span className={cn(currency === "IDR" && "text-blue-400 font-bold")}>
            IDR
          </span>
          <span className="text-slate-600">/</span>
          <span className={cn(currency === "USD" && "text-blue-400 font-bold")}>
            USD
          </span>
        </button>
      </div>
    </header>
  );
}
