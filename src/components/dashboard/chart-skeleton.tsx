"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

/**
 * Loading skeleton shown while chart data is being fetched from BigQuery.
 * Replaces the SampleDataBanner during loading state.
 */
export function ChartSkeleton({ height = 280 }: { height?: number }) {
  const { isDark } = useTheme();
  const barColor = isDark ? "bg-[var(--surface-elevated)]" : "bg-gray-200";
  const shimmer = isDark
    ? "bg-gradient-to-r from-transparent via-[#5B22FF]/5 to-transparent"
    : "bg-gradient-to-r from-transparent via-[#D00083]/5 to-transparent";

  return (
    <div
      className={cn(
        "rounded-xl border p-5 animate-pulse relative overflow-hidden",
        isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]"
      )}
    >
      {/* Title skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <div className={cn("h-4 rounded w-40", barColor)} />
          <div className={cn("h-2.5 rounded w-56", barColor, "opacity-60")} />
        </div>
        <div className={cn("h-3 rounded w-24", barColor, "opacity-40")} />
      </div>

      {/* Chart area skeleton — fake bar chart */}
      <div className="flex items-end gap-2 px-2" style={{ height }}>
        {[0.4, 0.65, 0.5, 0.8, 0.6, 0.75, 0.55, 0.9, 0.7, 0.45, 0.85, 0.6].map((h, i) => (
          <div
            key={i}
            className={cn("flex-1 rounded-t", barColor, "opacity-40")}
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>

      {/* Shimmer overlay */}
      <div
        className={cn("absolute inset-0", shimmer)}
        style={{
          animation: "shimmer 2s ease-in-out infinite",
        }}
      />

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

/**
 * Loading skeleton for a row of MetricCards.
 */
export function MetricCardsSkeleton({ count = 4 }: { count?: number }) {
  const { isDark } = useTheme();
  const barColor = isDark ? "bg-[var(--surface-elevated)]" : "bg-gray-200";

  return (
    <div className={cn("grid gap-4", count <= 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl border p-4 animate-pulse",
            isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]"
          )}
        >
          <div className={cn("h-2.5 rounded w-24 mb-3", barColor, "opacity-60")} />
          <div className={cn("h-7 rounded w-28 mb-2", barColor)} />
          <div className={cn("h-2 rounded w-20", barColor, "opacity-40")} />
        </div>
      ))}
    </div>
  );
}
