"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useCurrency } from "@/hooks/use-currency";
import { useTheme } from "@/hooks/use-theme";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface AreaConfig {
  key: string;
  color: string;
  label: string;
}

interface DashboardAreaChartProps {
  data: Record<string, string | number>[];
  areas: AreaConfig[];
  xAxisKey?: string;
  height?: number;
  valueType?: "count" | "currency";
  /** Previous period data to overlay as dashed lines */
  prevPeriodData?: Record<string, string | number>[];
  prevPeriodLabel?: string;
}

export function DashboardAreaChart({
  data,
  areas,
  xAxisKey = "date",
  height = 300,
  valueType = "currency",
  prevPeriodData,
  prevPeriodLabel = "Prev Period",
}: DashboardAreaChartProps) {
  const { currency } = useCurrency();
  const { isDark } = useTheme();

  const grid = isDark ? "#2D2955" : "#F0D9F7";
  const axis = isDark ? "#6B6394" : "#9B87A8";
  const tooltipBg = isDark ? "#1E1B3A" : "#FFFFFF";
  const tooltipBorder = isDark ? "#2D2955" : "#F0D9F7";
  const tooltipText = isDark ? "#F0EEFF" : "#2A1F3D";
  const prevColor = isDark ? "#6B6394" : "#9B87A8";

  const formatValue = (value: number) => {
    if (valueType === "currency") return formatCurrency(value, currency);
    return formatNumber(value, { compact: true });
  };

  // Merge prev data
  const mergedData = data.map((item, i) => {
    const merged: Record<string, string | number> = { ...item };
    if (prevPeriodData && i < prevPeriodData.length) {
      // Sum all areas for a single prev-period total line
      let prevTotal = 0;
      for (const area of areas) {
        const prevVal = prevPeriodData[i]?.[area.key];
        if (typeof prevVal === "number") prevTotal += prevVal;
      }
      merged["prev_total"] = prevTotal;
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
              if (name === "prev_total") {
                return [formatValue(Number(value)), `Total (${prevPeriodLabel})`];
              }
              const area = areas.find((a) => a.key === name);
              return [formatValue(Number(value)), area?.label ?? String(name)];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: axis }}
            formatter={(value) => {
              if (value === "prev_total") return `Total (${prevPeriodLabel})`;
              const area = areas.find((a) => a.key === value);
              return area?.label ?? String(value);
            }}
          />
          {/* Current period areas */}
          {areas.map((area) => (
            <Area
              key={area.key}
              type="monotone"
              dataKey={area.key}
              stackId="stack"
              stroke={area.color}
              fill={area.color}
              fillOpacity={0.6}
              name={area.key}
            />
          ))}
          {/* Previous period total overlay */}
          {prevPeriodData && (
            <Line
              type="monotone"
              dataKey="prev_total"
              stroke={prevColor}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              name="prev_total"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
