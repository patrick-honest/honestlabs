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
    <header className="flex h-16 items-center justify-between border-b border-[#2D2955] bg-[#0B0A1A]/80 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-[#F0EEFF]">{title}</h1>
        <span className="rounded-full bg-[#5B22FF]/10 px-3 py-1 text-xs font-medium text-[#7C4DFF]">
          {periodLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Period toggle */}
        <div className="flex rounded-lg bg-[#1E1B3A] p-0.5">
          {CYCLES.map((c) => (
            <button
              key={c.value}
              onClick={() => setPeriod(c.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                period === c.value
                  ? "bg-[#5B22FF] text-white"
                  : "text-[#6B6394] hover:text-[#F0EEFF]"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Currency toggle */}
        <button
          onClick={toggleCurrency}
          className="flex items-center gap-1 rounded-lg bg-[#1E1B3A] px-3 py-1.5 text-xs font-medium text-[#9B94C4] transition-colors hover:text-[#F0EEFF]"
        >
          <span className={cn(currency === "IDR" && "text-[#7C4DFF] font-bold")}>
            IDR
          </span>
          <span className="text-[#2D2955]">/</span>
          <span className={cn(currency === "USD" && "text-[#7C4DFF] font-bold")}>
            USD
          </span>
        </button>
      </div>
    </header>
  );
}
