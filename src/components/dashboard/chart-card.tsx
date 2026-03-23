"use client";

import { useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useTheme } from "@/hooks/use-theme";
import { QueryInspectorButton, type QueryInfo } from "@/components/query-inspector/query-inspector";
import { BreakdownFilter, type ActiveBreakdowns, type BreakdownDimension } from "@/components/filters/breakdown-filter";

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
  /** Show star badge indicating data is from BigQuery (not mock) */
  liveData?: boolean;
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
  liveData,
}: ChartCardProps) {
  const tMetrics = useTranslations("metrics");
  const { isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

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
        {children}
      </div>
    </div>
  );
}
