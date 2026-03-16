"use client";

import {
  ResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useCurrency } from "@/hooks/use-currency";
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
}

export function DashboardAreaChart({
  data,
  areas,
  xAxisKey = "date",
  height = 300,
  valueType = "currency",
}: DashboardAreaChartProps) {
  const { currency } = useCurrency();

  const formatValue = (value: number) => {
    if (valueType === "currency") return formatCurrency(value, currency);
    return formatNumber(value, { compact: true });
  };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
            formatter={(value, name) => {
              const area = areas.find((a) => a.key === name);
              return [formatValue(Number(value)), area?.label ?? String(name)];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
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
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
