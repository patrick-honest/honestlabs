"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useTheme } from "@/hooks/use-theme";
import { formatNumber } from "@/lib/utils";

interface BarConfig {
  key: string;
  color: string;
  label: string;
}

interface DashboardBarChartProps {
  data: Record<string, string | number>[];
  bars: BarConfig[];
  xAxisKey?: string;
  height?: number;
  stacked?: boolean;
  /** Previous period data to overlay as dashed lines */
  prevPeriodData?: Record<string, string | number>[];
  prevPeriodLabel?: string;
}

export function DashboardBarChart({
  data,
  bars,
  xAxisKey = "date",
  height = 300,
  stacked = false,
  prevPeriodData,
  prevPeriodLabel = "Prev Period",
}: DashboardBarChartProps) {
  const { isDark } = useTheme();

  const grid = isDark ? "#2D2955" : "#F0D9F7";
  const axis = isDark ? "#6B6394" : "#9B87A8";
  const tooltipBg = isDark ? "#1E1B3A" : "#FFFFFF";
  const tooltipBorder = isDark ? "#2D2955" : "#F0D9F7";
  const tooltipText = isDark ? "#F0EEFF" : "#2A1F3D";
  const prevColor = isDark ? "#6B6394" : "#9B87A8";

  // Merge prev period data if provided
  const mergedData = data.map((item, i) => {
    const merged: Record<string, string | number> = { ...item };
    if (prevPeriodData && i < prevPeriodData.length) {
      for (const bar of bars) {
        const prevVal = prevPeriodData[i]?.[bar.key];
        if (prevVal !== undefined) {
          merged[`prev_${bar.key}`] = prevVal;
        }
      }
    }
    return merged;
  });

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={mergedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
            tickFormatter={(v) => formatNumber(v as number, { compact: true })}
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
              const bar = bars.find((b) => b.key === baseKey);
              const label = isPrev
                ? `${bar?.label ?? baseKey} (${prevPeriodLabel})`
                : bar?.label ?? String(name);
              return [formatNumber(Number(value)), label];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: axis }}
            formatter={(value) => {
              const isPrev = String(value).startsWith("prev_");
              const baseKey = isPrev ? String(value).replace("prev_", "") : String(value);
              const bar = bars.find((b) => b.key === baseKey);
              return isPrev
                ? `${bar?.label ?? baseKey} (${prevPeriodLabel})`
                : bar?.label ?? String(value);
            }}
          />
          {/* Current period bars */}
          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              fill={bar.color}
              name={bar.key}
              stackId={stacked ? "stack" : undefined}
              radius={stacked ? undefined : [4, 4, 0, 0]}
            />
          ))}
          {/* Previous period overlay lines */}
          {prevPeriodData && bars.slice(0, 1).map((bar) => (
            <Line
              key={`prev_${bar.key}`}
              type="monotone"
              dataKey={`prev_${bar.key}`}
              stroke={prevColor}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              name={`prev_${bar.key}`}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
