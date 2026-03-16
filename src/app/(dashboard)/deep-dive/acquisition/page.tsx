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

// --- Mock data ---
const AS_OF = "Mar 15, 2026";
const DATA_RANGE = { start: "Mar 10, 2026", end: "Mar 16, 2026" };

const funnelStages = [
  { stage: "Waitlisted", count: 12400, rate: null },
  { stage: "Apply Started", count: 8900, rate: 71.8 },
  { stage: "KYC Submitted", count: 7200, rate: 80.9 },
  { stage: "Documents Verified", count: 6100, rate: 84.7 },
  { stage: "Decision Made", count: 5800, rate: 95.1 },
  { stage: "Approved", count: 4200, rate: 72.4 },
  { stage: "Card Shipped", count: 3900, rate: 92.9 },
  { stage: "Card Activated", count: 3400, rate: 87.2 },
  { stage: "PIN Set", count: 3200, rate: 94.1 },
];

const decisionBreakdown = [
  { date: "W1 Feb", approved: 980, declined: 320, waitlisted: 150 },
  { date: "W2 Feb", approved: 1050, declined: 290, waitlisted: 180 },
  { date: "W3 Feb", approved: 1100, declined: 310, waitlisted: 160 },
  { date: "W4 Feb", approved: 1020, declined: 350, waitlisted: 200 },
  { date: "W1 Mar", approved: 1150, declined: 280, waitlisted: 170 },
  { date: "W2 Mar", approved: 1200, declined: 260, waitlisted: 140 },
];

const productMix = [
  { name: "Standard CC", value: 2800, color: "#3b82f6" },
  { name: "Prepaid", value: 900, color: "#8b5cf6" },
  { name: "Opening Fee", value: 500, color: "#06b6d4" },
];

const approvalRateTrend = [
  { date: "Oct", rate: 68.2 },
  { date: "Nov", rate: 70.1 },
  { date: "Dec", rate: 69.5 },
  { date: "Jan", rate: 71.8 },
  { date: "Feb", rate: 72.4 },
  { date: "Mar", rate: 73.1 },
];

const avgCreditLineTrend = [
  { date: "Oct", avgLimit: 8500000 },
  { date: "Nov", avgLimit: 8700000 },
  { date: "Dec", avgLimit: 8600000 },
  { date: "Jan", avgLimit: 9100000 },
  { date: "Feb", avgLimit: 9300000 },
  { date: "Mar", avgLimit: 9500000 },
];

const vintageCounts = [
  { month: "Oct 2025", count: 3200 },
  { month: "Nov 2025", count: 3450 },
  { month: "Dec 2025", count: 2900 },
  { month: "Jan 2026", count: 3800 },
  { month: "Feb 2026", count: 4100 },
  { month: "Mar 2026", count: 4200 },
];

const actionItems: ActionItem[] = [
  {
    id: "acq-1",
    priority: "urgent",
    action: "KYC drop-off is high at 19.1%.",
    detail: "Investigate friction in document upload flow. Consider simplifying ID verification steps.",
  },
  {
    id: "acq-2",
    priority: "monitor",
    action: "Decline rate trending down to 18.3%.",
    detail: "Scorecard recalibration in Jan appears effective. Continue monitoring false-negative rates.",
  },
  {
    id: "acq-3",
    priority: "positive",
    action: "Approval rate improved to 73.1%.",
    detail: "Highest in 6 months. Average credit line also trending up to Rp 9.5M.",
  },
];

// --- Component ---
export default function AcquisitionPage() {
  const { periodLabel } = usePeriod();

  const handleRefresh = useCallback(async () => {
    // TODO: SWR mutate for specific metric
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Acquisition Deep Dive</h1>
        <p className="text-sm text-slate-400 mt-1">{periodLabel}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="acq_total_applications"
          label="Total Applications"
          value={8900}
          prevValue={8200}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="acq_approval_rate"
          label="Approval Rate"
          value={73.1}
          prevValue={72.4}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          target={75}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="acq_avg_credit_line"
          label="Avg Credit Line"
          value={9500000}
          prevValue={9300000}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="acq_cards_activated"
          label="Cards Activated"
          value={3400}
          prevValue={3100}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Funnel visualization */}
      <ChartCard
        title="Application Funnel"
        subtitle="Conversion rates between stages"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <div className="space-y-1">
          {funnelStages.map((stage, i) => {
            const maxCount = funnelStages[0].count;
            const widthPct = (stage.count / maxCount) * 100;
            const convColor =
              stage.rate === null
                ? ""
                : stage.rate >= 90
                  ? "text-emerald-400"
                  : stage.rate >= 75
                    ? "text-blue-400"
                    : "text-red-400";

            return (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="w-36 text-xs text-slate-400 text-right shrink-0">
                  {stage.stage}
                </span>
                <div className="flex-1 h-7 relative">
                  <div
                    className="h-full rounded bg-gradient-to-r from-blue-600/80 to-blue-500/40 flex items-center px-2"
                    style={{ width: `${widthPct}%` }}
                  >
                    <span className="text-xs font-semibold text-white">
                      {stage.count.toLocaleString()}
                    </span>
                  </div>
                </div>
                {stage.rate !== null && (
                  <span className={`w-14 text-xs font-medium text-right shrink-0 ${convColor}`}>
                    {stage.rate}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </ChartCard>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Decision Breakdown */}
        <ChartCard
          title="Decision Breakdown"
          subtitle="Approved / Declined / Waitlisted by week"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={decisionBreakdown}
            bars={[
              { key: "approved", color: "#22c55e", label: "Approved" },
              { key: "declined", color: "#ef4444", label: "Declined" },
              { key: "waitlisted", color: "#f59e0b", label: "Waitlisted" },
            ]}
            stacked
            height={280}
          />
        </ChartCard>

        {/* Product Mix */}
        <ChartCard
          title="Product Mix"
          subtitle="Approved accounts by product type"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {productMix.map((entry) => (
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
      </div>

      {/* Line charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Approval Rate Trend"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={approvalRateTrend}
            lines={[{ key: "rate", color: "#3b82f6", label: "Approval Rate %" }]}
            valueType="percent"
            height={260}
          />
        </ChartCard>

        <ChartCard
          title="Avg Approved Credit Limit"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={avgCreditLineTrend}
            lines={[{ key: "avgLimit", color: "#8b5cf6", label: "Avg Limit" }]}
            valueType="currency"
            height={260}
          />
        </ChartCard>
      </div>

      {/* Vintage table */}
      <ChartCard
        title="Vintage Acquisition Counts"
        subtitle="Monthly cohort new accounts"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Cohort Month</th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">New Accounts</th>
              </tr>
            </thead>
            <tbody>
              {vintageCounts.map((row) => (
                <tr key={row.month} className="border-b border-slate-800">
                  <td className="py-2 px-3 text-slate-300">{row.month}</td>
                  <td className="py-2 px-3 text-white text-right font-medium">
                    {row.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Action items */}
      <ActionItems section="Acquisition" items={actionItems} />
    </div>
  );
}
