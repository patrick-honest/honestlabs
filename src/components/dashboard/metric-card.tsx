"use client";

import { useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { formatAmountCompact } from "@/lib/currency";
import { useCurrency } from "@/hooks/use-currency";
import { useTheme } from "@/hooks/use-theme";
import { QueryInspectorButton, type QueryInfo } from "@/components/query-inspector/query-inspector";

interface MetricCardProps {
  metricKey: string;
  label: string;
  value: number;
  prevValue?: number | null;
  unit: "count" | "percent" | "idr" | "usd";
  asOf: string;
  dataRange: { start: string; end: string };
  sparklineData?: number[];
  target?: number;
  higherIsBetter?: boolean;
  onRefresh?: () => Promise<void>;
  query?: QueryInfo;
  /** Show star badge indicating data is from BigQuery (not mock) */
  liveData?: boolean;
}

function formatValue(value: number, unit: MetricCardProps["unit"], currency: "IDR" | "USD"): string {
  switch (unit) {
    case "count":
      return formatNumber(value, { compact: true });
    case "percent":
      return formatPercent(value);
    case "idr":
      return formatAmountCompact(value, currency);
    case "usd":
      return formatAmountCompact(value, "USD");
    default:
      return String(value);
  }
}

function computeChange(value: number, prevValue: number | null | undefined) {
  if (prevValue == null || prevValue === 0) return { percent: null, direction: "flat" as const };
  const percent = ((value - prevValue) / Math.abs(prevValue)) * 100;
  const direction = percent > 0.5 ? ("up" as const) : percent < -0.5 ? ("down" as const) : ("flat" as const);
  return { percent, direction };
}

export function MetricCard({
  metricKey,
  label,
  value,
  prevValue,
  unit,
  asOf,
  dataRange,
  sparklineData,
  target,
  higherIsBetter = true,
  onRefresh,
  query,
  liveData,
}: MetricCardProps) {
  const { currency } = useCurrency();
  const { isDark } = useTheme();
  const tMetrics = useTranslations("metrics");
  const [refreshing, setRefreshing] = useState(false);

  const { percent: changePercent, direction } = computeChange(value, prevValue);

  const isPositive =
    direction === "flat"
      ? null
      : higherIsBetter
        ? direction === "up"
        : direction === "down";

  const changeColor =
    isPositive === null
      ? "text-[var(--text-secondary)]"
      : isPositive
        ? isDark ? "text-[#06D6A0]" : "text-[#059669]"
        : isDark ? "text-[#FF6B6B]" : "text-[#DC2626]";

  const DirectionIcon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  const sparkData = sparklineData?.map((v) => ({ value: v }));

  const targetPercent = target != null && target > 0 ? Math.min((value / target) * 100, 100) : null;

  async function handleRefresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  const accentColor = isDark ? "#5B22FF" : "#D00083";
  const sparkColor = isPositive === false ? (isDark ? "#FF6B6B" : "#DC2626") : accentColor;

  return (
    <div className={cn(
      "relative flex flex-col justify-between rounded-xl border p-4 transition-colors",
      isDark
        ? "border-[var(--border)] bg-[var(--surface)]"
        : "border-[var(--border)] bg-[var(--surface)] shadow-sm"
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1">
            {label}
            {liveData && (
              <span className={cn("text-[9px]", isDark ? "text-[#FFD166]" : "text-amber-500")} title="Live BigQuery data">&#9733;</span>
            )}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
            {dataRange.start} &ndash; {dataRange.end}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {sparkData && sparkData.length > 1 && (
            <div className="h-8 w-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={sparkColor}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {query && <QueryInspectorButton query={query} />}

          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[var(--text-muted)] hover:text-[var(--accent-light)] transition-colors disabled:opacity-50"
              aria-label={`${tMetrics("refresh")} ${label}`}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      {/* Value */}
      <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
        {formatValue(value, unit, currency)}
      </p>

      {/* Change indicator */}
      {changePercent !== null && (
        <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium", changeColor)}>
          <DirectionIcon className="h-3 w-3" />
          <span>{Math.abs(Math.round(changePercent * 100) / 100)}{tMetrics("vsPrevPeriod")}</span>
        </div>
      )}

      {/* Target progress */}
      {targetPercent !== null && target != null && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-0.5">
            <span>{tMetrics("target")}: {formatValue(target, unit, currency)}</span>
            <span>{targetPercent.toFixed(0)}%</span>
          </div>
          <div className={cn(
            "h-1 w-full rounded-full",
            isDark ? "bg-[var(--surface-elevated)]" : "bg-[var(--border)]"
          )}>
            <div
              className={cn(
                "h-1 rounded-full transition-all",
                targetPercent >= 100
                  ? isDark ? "bg-[#06D6A0]" : "bg-[#059669]"
                  : targetPercent >= 75
                    ? isDark ? "bg-[#5B22FF]" : "bg-[#D00083]"
                    : isDark ? "bg-[#FFD166]" : "bg-[#F5A623]"
              )}
              style={{ width: `${targetPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* As of date */}
      <p className="mt-2 text-[10px] text-[var(--text-muted)] text-right">
        {tMetrics("asOf")}: {asOf}
      </p>
    </div>
  );
}
