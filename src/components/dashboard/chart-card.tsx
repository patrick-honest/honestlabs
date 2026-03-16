"use client";

import { useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
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
}: ChartCardProps) {
  const [refreshing, setRefreshing] = useState(false);

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
    <div className={cn("rounded-xl border border-[#2D2955] bg-[#141226] overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 bg-[#1E1B3A]/50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#F0EEFF]">{title}</h3>
            {query && <QueryInspectorButton query={query} />}
          </div>
          {subtitle && (
            <p className="text-xs text-[#9B94C4] mt-0.5">{subtitle}</p>
          )}
          <p className="text-[10px] text-[#6B6394] mt-0.5">
            {dataRange.start} &ndash; {dataRange.end}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[#6B6394]">As of: {asOf}</span>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[#6B6394] hover:text-[#7C4DFF] transition-colors disabled:opacity-50"
              aria-label={`Refresh ${title}`}
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
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#141226]/70 backdrop-blur-[1px]">
            <RefreshCw className="h-5 w-5 animate-spin text-[#7C4DFF]" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
