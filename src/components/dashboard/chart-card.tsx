"use client";

import { useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { QueryInspectorButton, type QueryInfo } from "@/components/query-inspector/query-inspector";
import { BreakdownFilter, type ActiveBreakdowns, type BreakdownDimension } from "@/components/filters/breakdown-filter";
import { ChartDateRange, type DateRangeOverride } from "@/components/charts/chart-date-range";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  asOf: string;
  dataRange: { start: string; end: string };
  onRefresh?: () => Promise<void>;
  children: ReactNode;
  className?: string;
  /** SQL query info for the inspector */
  query?: QueryInfo;
  /** Breakdown filter support */
  breakdowns?: ActiveBreakdowns;
  onBreakdownChange?: (b: ActiveBreakdowns) => void;
  availableBreakdowns?: BreakdownDimension[];
  /** Chart-level date range override (controlled mode) */
  dateOverride?: DateRangeOverride | null;
  onDateOverride?: (range: DateRangeOverride | null) => void;
  /** Set false to hide the date picker (default: true) */
  showDatePicker?: boolean;
}

export function ChartCard({
  title,
  subtitle,
  asOf,
  dataRange,
  onRefresh,
  children,
  className,
  query,
  breakdowns,
  onBreakdownChange,
  availableBreakdowns,
  dateOverride: controlledDateOverride,
  onDateOverride: controlledOnDateOverride,
  showDatePicker = true,
}: ChartCardProps) {
  const tMetrics = useTranslations("metrics");
  const [refreshing, setRefreshing] = useState(false);
  // Self-managed date override when no external control is provided
  const [internalDateOverride, setInternalDateOverride] = useState<DateRangeOverride | null>(null);
  const dateOverride = controlledOnDateOverride ? controlledDateOverride ?? null : internalDateOverride;
  const onDateOverride = controlledOnDateOverride ?? setInternalDateOverride;

  async function handleRefresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className={cn(
      "rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-colors",
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 bg-[var(--surface-elevated)]/50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
            {query && <QueryInspectorButton query={query} />}
          </div>
          {subtitle && (
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
          )}
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
            {(dateOverride ?? dataRange).start} &ndash; {(dateOverride ?? dataRange).end}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showDatePicker && (
            <ChartDateRange override={dateOverride} onOverride={onDateOverride} />
          )}
          <span className="text-[10px] text-[var(--text-muted)]">{tMetrics("asOf")}: {asOf}</span>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[var(--text-muted)] hover:text-[var(--accent-light)] transition-colors disabled:opacity-50"
              aria-label={tMetrics("refresh") + " " + title}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      {/* Breakdown filters */}
      {onBreakdownChange && (
        <div className="px-4 pt-2">
          <BreakdownFilter
            active={breakdowns ?? {}}
            onChange={onBreakdownChange}
            availableDimensions={availableBreakdowns}
          />
        </div>
      )}

      {/* Body */}
      <div className="relative p-4">
        {refreshing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--surface)]/70 backdrop-blur-[1px]">
            <RefreshCw className="h-5 w-5 animate-spin text-[var(--accent-light)]" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
