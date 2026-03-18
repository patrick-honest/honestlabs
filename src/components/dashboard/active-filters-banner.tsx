"use client";

import { useFilters } from "@/hooks/use-filters";
import { getFilterSummary, getFilterMultiplier } from "@/lib/filter-utils";
import { Filter, X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Inline banner shown below page titles when filters are active.
 * Shows which filter groups are in use and the approximate data slice %.
 */
export function ActiveFiltersBanner() {
  const { filters, activeFilterCount, clearFilters } = useFilters();
  const tBanner = useTranslations("filterBanner");

  if (activeFilterCount === 0) return null;

  const summary = getFilterSummary(filters);
  const multiplier = getFilterMultiplier(filters);
  const pct = Math.round(multiplier * 100);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs">
      <Filter className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
      <span className="text-[var(--text-secondary)]">
        <span className="font-medium text-[var(--text-primary)]">{activeFilterCount} {activeFilterCount !== 1 ? tBanner("filters") : tBanner("filter")}</span>
        {" "}{tBanner("active", { pct })}
      </span>
      <span className="text-[var(--text-muted)]">·</span>
      <span className="text-[var(--text-muted)] truncate">{summary}</span>
      <button
        onClick={clearFilters}
        className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)] transition-colors"
        title={tBanner("clearAll")}
      >
        <X className="h-3 w-3" />
        <span>{tBanner("clearLabel")}</span>
      </button>
    </div>
  );
}
