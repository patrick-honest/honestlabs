"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { KpiMetric } from "@/types/reports";

interface KpiCardProps {
  kpi: KpiMetric;
  sparklineData?: { value: number }[];
}

function formatValue(value: number, unit: KpiMetric["unit"], currency: "IDR" | "USD"): string {
  switch (unit) {
    case "count":
      return formatNumber(value, { compact: true });
    case "percent":
      return formatPercent(value);
    case "idr":
      return formatCurrency(value, currency);
    case "usd":
      return formatCurrency(value, "USD");
    default:
      return String(value);
  }
}

export function KpiCard({ kpi, sparklineData }: KpiCardProps) {
  const { currency } = useCurrency();
  const { label, value, unit, changePercent, direction } = kpi;

  const DirectionIcon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  const changeColor =
    direction === "up"
      ? "text-[var(--success)]"
      : direction === "down"
        ? "text-[var(--danger)]"
        : "text-[var(--text-muted)]";

  const sparkColor = direction === "down" ? "var(--danger)" : "var(--accent)";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </p>
        {sparklineData && sparklineData.length > 1 && (
          <div className="h-8 w-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
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
      </div>

      <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
        {formatValue(value, unit, currency)}
      </p>

      {changePercent !== null && (
        <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium", changeColor)}>
          <DirectionIcon className="h-3 w-3" />
          <span>{Math.abs(changePercent).toFixed(1)}% vs prev period</span>
        </div>
      )}
    </div>
  );
}
