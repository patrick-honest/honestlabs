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
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey={xAxisKey}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatValue(v as number)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              color: "#f1f5f9",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => {
              const line = lines.find((l) => l.key === name);
              return [formatValue(value), line?.label ?? name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
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
