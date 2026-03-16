"use client";

import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
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
}

export function DashboardBarChart({
  data,
  bars,
  xAxisKey = "date",
  height = 300,
  stacked = false,
}: DashboardBarChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
            tickFormatter={(v) => formatNumber(v as number, { compact: true })}
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
              const bar = bars.find((b) => b.key === name);
              return [formatNumber(Number(value)), bar?.label ?? String(name)];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#6B6394" }} />
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
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
