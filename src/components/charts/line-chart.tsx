"use client";

import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useCurrency } from "@/hooks/use-currency";
import { useTheme } from "@/hooks/use-theme";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";

interface LineConfig {
  key: string;
  color: string;
  label: string;
}

interface DashboardLineChartProps {
  data: Record<string, string | number>[];
  lines: LineConfig[];
  xAxisKey?: string;
  height?: number;
  valueType?: "count" | "percent" | "currency";
  /** Previous period data to overlay as dashed lines */
  prevPeriodData?: Record<string, string | number>[];
  /** Label for previous period in legend (e.g., "Prev Month") */
  prevPeriodLabel?: string;
}

export function DashboardLineChart({
  data,
  lines,
  xAxisKey = "date",
  height = 300,
  valueType = "count",
  prevPeriodData,
  prevPeriodLabel = "Prev Period",
}: DashboardLineChartProps) {
  const { currency } = useCurrency();
  const { isDark } = useTheme();

  const grid = isDark ? "#2D2955" : "#F0D9F7";
  const axis = isDark ? "#6B6394" : "#9B87A8";
  const tooltipBg = isDark ? "#1E1B3A" : "#FFFFFF";
  const tooltipBorder = isDark ? "#2D2955" : "#F0D9F7";
  const tooltipText = isDark ? "#F0EEFF" : "#2A1F3D";
  const prevColor = isDark ? "#6B6394" : "#9B87A8";

  const formatValue = (value: number) => {
    switch (valueType) {
      case "percent":
        return formatPercent(value);
      case "currency":
        return formatCurrency(value, currency);
      default:
        return formatNumber(value, { compact: true });
    }
  };

  // Merge current + prev period data using index alignment
  const mergedData = data.map((item, i) => {
    const merged: Record<string, string | number> = { ...item };
    if (prevPeriodData && i < prevPeriodData.length) {
      for (const line of lines) {
        const prevVal = prevPeriodData[i]?.[line.key];
        if (prevVal !== undefined) {
          merged[`prev_${line.key}`] = prevVal;
        }
      }
    }
    return merged;
  });

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={mergedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis
            dataKey={xAxisKey}
            tick={{ fill: axis, fontSize: 11 }}
            axisLine={{ stroke: grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatValue(v as number)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: 8,
              color: tooltipText,
              fontSize: 12,
            }}
            formatter={(value, name) => {
              const isPrev = String(name).startsWith("prev_");
              const baseKey = isPrev ? String(name).replace("prev_", "") : String(name);
              const line = lines.find((l) => l.key === baseKey);
              const label = isPrev
                ? `${line?.label ?? baseKey} (${prevPeriodLabel})`
                : line?.label ?? String(name);
              return [formatValue(Number(value)), label];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: axis }}
            formatter={(value) => {
              const isPrev = String(value).startsWith("prev_");
              const baseKey = isPrev ? String(value).replace("prev_", "") : String(value);
              const line = lines.find((l) => l.key === baseKey);
              return isPrev
                ? `${line?.label ?? baseKey} (${prevPeriodLabel})`
                : line?.label ?? String(value);
            }}
          />
          {/* Previous period lines (dashed, muted) */}
          {prevPeriodData && lines.map((line) => (
            <Line
              key={`prev_${line.key}`}
              type="monotone"
              dataKey={`prev_${line.key}`}
              stroke={prevColor}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              name={`prev_${line.key}`}
            />
          ))}
          {/* Current period lines */}
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              name={line.key}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
