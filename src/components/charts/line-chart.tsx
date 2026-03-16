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
}

export function DashboardLineChart({
  data,
  lines,
  xAxisKey = "date",
  height = 300,
  valueType = "count",
}: DashboardLineChartProps) {
  const { currency } = useCurrency();

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

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2D2955" />
          <XAxis
            dataKey={xAxisKey}
            tick={{ fill: "#6B6394", fontSize: 11 }}
            axisLine={{ stroke: "#2D2955" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6B6394", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatValue(v as number)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1E1B3A",
              border: "1px solid #2D2955",
              borderRadius: 8,
              color: "#F0EEFF",
              fontSize: 12,
            }}
            formatter={(value, name) => {
              const line = lines.find((l) => l.key === name);
              return [formatValue(Number(value)), line?.label ?? String(name)];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#6B6394" }}
          />
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
