"use client";

import { useState, useMemo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useTheme } from "@/hooks/use-theme";
import { QueryInspectorButton, type QueryInfo } from "@/components/query-inspector/query-inspector";
import { BreakdownFilter, type ActiveBreakdowns, type BreakdownDimension } from "@/components/filters/breakdown-filter";

export type ChartIncrement = "daily" | "weekly" | "monthly";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  asOf: string;
  dataRange: { start: string; end: string };
  onRefresh?: () => Promise<void>;
  children: ReactNode | ((increment: ChartIncrement) => ReactNode);
  className?: string;
  /** SQL query info for the inspector */
  query?: QueryInfo;
  /** Breakdown filter support */
  breakdowns?: ActiveBreakdowns;
  onBreakdownChange?: (b: ActiveBreakdowns) => void;
  availableBreakdowns?: BreakdownDimension[];
  /** Show star badge indicating data is from BigQuery (not mock) */
  liveData?: boolean;
  /** Show the time increment selector (daily/weekly/monthly). Default: false */
  showIncrement?: boolean;
  /** Default increment. Default: "weekly" */
  defaultIncrement?: ChartIncrement;
  /** Controlled increment (overrides internal state) */
  increment?: ChartIncrement;
  /** Called when user changes increment */
  onIncrementChange?: (inc: ChartIncrement) => void;
}

/**
 * Compute the number of days in the date range.
 */
function daysBetween(start: string, end: string): number {
  const a = new Date(start + "T00:00:00Z");
  const b = new Date(end + "T00:00:00Z");
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

const INCREMENT_OPTIONS: { value: ChartIncrement; label: string; minDays: number }[] = [
  { value: "daily", label: "D", minDays: 1 },
  { value: "weekly", label: "W", minDays: 7 },
  { value: "monthly", label: "M", minDays: 28 },
];

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
  liveData,
  showIncrement = false,
  defaultIncrement = "weekly",
  increment: controlledIncrement,
  onIncrementChange,
}: ChartCardProps) {
  const tMetrics = useTranslations("metrics");
  const { isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [internalIncrement, setInternalIncrement] = useState<ChartIncrement>(defaultIncrement);

  const increment = controlledIncrement ?? internalIncrement;
  const setIncrement = onIncrementChange ?? setInternalIncrement;

  const rangeDays = useMemo(() => daysBetween(dataRange.start, dataRange.end), [dataRange]);

  async function handleRefresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
      setLastRefreshed(new Date().toLocaleString());
    } finally {
      setRefreshing(false);
    }
  }

  const displayTimestamp = lastRefreshed ?? asOf;

  return (
    <div className={cn(
      "rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-colors",
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 bg-[var(--surface-elevated)]/50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {title}
              {liveData && (
                <span className={cn("ml-1 text-[9px]", isDark ? "text-[#FFD166]" : "text-amber-500")} title="Live BigQuery data">&#9733;</span>
              )}
            </h3>
            {query && <QueryInspectorButton query={query} />}
          </div>
          {subtitle && (
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
          )}
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
            {dataRange.start} &ndash; {dataRange.end}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Time increment selector */}
          {showIncrement && (
            <div className="flex items-center rounded-md border border-[var(--border)] overflow-hidden">
              {INCREMENT_OPTIONS.map((opt) => {
                const enabled = rangeDays >= opt.minDays;
                const active = increment === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => enabled && setIncrement(opt.value)}
                    disabled={!enabled}
                    title={!enabled ? "Selected time range too small" : opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}
                    className={cn(
                      "px-2 py-1 text-[10px] font-semibold transition-colors",
                      active
                        ? isDark
                          ? "bg-[#5B22FF] text-white"
                          : "bg-[#D00083] text-white"
                        : enabled
                          ? "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
                          : "text-[var(--text-muted)]/40 cursor-not-allowed opacity-40",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
          <span className="text-[10px] text-[var(--text-muted)]">{tMetrics("asOf")}: {displayTimestamp}</span>
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
        {typeof children === "function" ? children(increment) : children}
      </div>
    </div>
  );
}
