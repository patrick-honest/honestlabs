"use client";

import { useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  asOf: string;
  dataRange: { start: string; end: string };
  onRefresh?: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  asOf,
  dataRange,
  onRefresh,
  children,
  className,
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
    <div className={cn("rounded-xl border border-slate-800 bg-slate-900 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 bg-slate-800/50 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
          <p className="text-[10px] text-slate-500 mt-0.5">
            {dataRange.start} &ndash; {dataRange.end}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500">As of: {asOf}</span>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-slate-500 hover:text-blue-400 transition-colors disabled:opacity-50"
              aria-label={`Refresh ${title}`}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="relative p-4">
        {refreshing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/70 backdrop-blur-[1px]">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
