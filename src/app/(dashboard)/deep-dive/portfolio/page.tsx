"use client";

import { useCallback } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { usePeriod } from "@/hooks/use-period";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

const AS_OF = "Mar 15, 2026";
const DATA_RANGE = { start: "Mar 10, 2026", end: "Mar 16, 2026" };

// Mock data
const activeAccountsTrend = [
  { date: "Oct", active: 18500 },
  { date: "Nov", active: 19200 },
  { date: "Dec", active: 20100 },
  { date: "Jan", active: 21000 },
  { date: "Feb", active: 21800 },
  { date: "Mar", active: 22500 },
];

const newAccountsPerPeriod = [
  { date: "Oct", newAccounts: 3200 },
  { date: "Nov", newAccounts: 3450 },
  { date: "Dec", newAccounts: 2900 },
  { date: "Jan", newAccounts: 3800 },
  { date: "Feb", newAccounts: 4100 },
  { date: "Mar", newAccounts: 4200 },
];

const creditLimitDistribution = [
  { bucket: "0-5M", count: 4200 },
  { bucket: "5-10M", count: 8100 },
  { bucket: "10-15M", count: 5800 },
  { bucket: "15-20M", count: 2900 },
  { bucket: "20-30M", count: 1100 },
  { bucket: "30M+", count: 400 },
];

const creditUtilization = [
  { date: "Oct", utilization: 32.5 },
  { date: "Nov", utilization: 34.1 },
  { date: "Dec", utilization: 38.8 },
  { date: "Jan", utilization: 35.2 },
  { date: "Feb", utilization: 36.1 },
  { date: "Mar", utilization: 37.4 },
];

const accountStatusBreakdown = [
  { name: "Good/Normal", value: 20800, color: "#22c55e" },
  { name: "Blocked", value: 850, color: "#f59e0b" },
  { name: "Closed", value: 620, color: "#ef4444" },
  { name: "Suspended", value: 230, color: "#6b7280" },
];

const repaymentMetrics = [
  { date: "Oct", volume: 15000000000, count: 12500 },
  { date: "Nov", volume: 16200000000, count: 13100 },
  { date: "Dec", volume: 18500000000, count: 14800 },
  { date: "Jan", volume: 17000000000, count: 13900 },
  { date: "Feb", volume: 17800000000, count: 14200 },
  { date: "Mar", volume: 18200000000, count: 14600 },
];

const actionItems: ActionItem[] = [
  {
    id: "port-1",
    priority: "positive",
    action: "Portfolio growing steadily at ~700 net new accounts/month.",
    detail: "Active accounts reached 22.5K. Credit utilization at healthy 37.4%.",
  },
  {
    id: "port-2",
    priority: "monitor",
    action: "Credit utilization trending up from 32.5% to 37.4%.",
    detail: "Still within normal range but worth monitoring. Higher utilization may signal increased risk for some segments.",
  },
  {
    id: "port-3",
    priority: "monitor",
    action: "850 accounts in blocked status.",
    detail: "Review blocked accounts for potential reactivation or closure. Some may be resolved fraud cases.",
  },
];

export default function PortfolioPage() {
  const { periodLabel } = usePeriod();

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Portfolio Deep Dive</h1>
        <p className="text-sm text-slate-400 mt-1">{periodLabel}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="port_active_accounts"
          label="Active Accounts"
          value={22500}
          prevValue={21800}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={activeAccountsTrend.map((d) => d.active)}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="port_new_accounts"
          label="New Accounts (Period)"
          value={4200}
          prevValue={4100}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="port_utilization"
          label="Avg Credit Utilization"
          value={37.4}
          prevValue={36.1}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="port_repayment_vol"
          label="Repayment Volume"
          value={18200000000}
          prevValue={17800000000}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Active Accounts Trend"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={activeAccountsTrend}
            lines={[{ key: "active", color: "#3b82f6", label: "Active Accounts" }]}
            height={280}
          />
        </ChartCard>

        <ChartCard
          title="New Accounts per Period"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={newAccountsPerPeriod}
            bars={[{ key: "newAccounts", color: "#22c55e", label: "New Accounts" }]}
            height={280}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Credit Limit Distribution"
          subtitle="Accounts by approved credit limit bucket"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={creditLimitDistribution}
            bars={[{ key: "count", color: "#8b5cf6", label: "Accounts" }]}
            xAxisKey="bucket"
            height={280}
          />
        </ChartCard>

        <ChartCard
          title="Credit Utilization Trend"
          subtitle="Average utilization % over time"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={creditUtilization}
            lines={[{ key: "utilization", color: "#f59e0b", label: "Utilization %" }]}
            valueType="percent"
            height={280}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Account Status Breakdown"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={accountStatusBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {accountStatusBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    color: "#f1f5f9",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Repayment Metrics"
          subtitle="Monthly repayment volume and transaction count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={repaymentMetrics}
            bars={[{ key: "count", color: "#06b6d4", label: "Repayment Count" }]}
            height={280}
          />
        </ChartCard>
      </div>

      <ActionItems section="Portfolio" items={actionItems} />
    </div>
  );
}
