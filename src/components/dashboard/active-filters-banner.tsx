"use client";

import { useFilters, type FilterSelections } from "@/hooks/use-filters";
import { getFilterMultiplier } from "@/lib/filter-utils";
import { Filter, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

const FILTER_LABELS: Record<keyof FilterSelections, string> = {
  cardType: "Card",
  productType: "Product",
  cohort: "Cohort",
  cycleDate: "Cycle",
  transactionType: "Txn",
  transactionChannel: "Channel",
  transactionStatus: "Status",
  merchantCategory: "MCC",
  amountRange: "Amount",
  recurringType: "Recurring",
  riskCategory: "Risk",
  decisioningModel: "Model",
};

/**
 * Inline banner showing each active filter as a removable chip.
 * Clicking X on a chip removes that single value.
 * "Clear all" removes everything.
 */
export function ActiveFiltersBanner() {
  const { filters, activeFilterCount, clearFilters, toggleFilterValue } = useFilters();
  const { isDark } = useTheme();
  const tBanner = useTranslations("filterBanner");

  if (activeFilterCount === 0) return null;

  const multiplier = getFilterMultiplier(filters);
  const pct = Math.round(multiplier * 100);

  // Collect all active filter values as flat list of chips
  const chips: { key: keyof FilterSelections; value: string; label: string }[] = [];
  for (const [key, values] of Object.entries(filters) as [keyof FilterSelections, string[]][]) {
    for (const value of values) {
      chips.push({
        key,
        value,
        label: `${FILTER_LABELS[key]}: ${value}`,
      });
    }
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2">
      <Filter className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] mt-0.5" />

      <div className="flex-1 min-w-0">
        {/* Summary line */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] text-[var(--text-muted)]">
            {tBanner("activeShowing", { pct: String(pct) })}
          </span>
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)] transition-colors"
            title={tBanner("clearAll")}
          >
            <X className="h-3 w-3" />
            <span>{tBanner("clearLabel")}</span>
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <button
              key={`${chip.key}-${chip.value}`}
              onClick={() => toggleFilterValue(chip.key, chip.value)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                isDark
                  ? "bg-[#5B22FF]/15 text-[#7C4DFF] hover:bg-[#5B22FF]/25"
                  : "bg-[#D00083]/8 text-[#D00083] hover:bg-[#D00083]/15"
              )}
              title={`Remove ${chip.label}`}
            >
              <span>{chip.label}</span>
              <X className="h-2.5 w-2.5 opacity-60 hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
