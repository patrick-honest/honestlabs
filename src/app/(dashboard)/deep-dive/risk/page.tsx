"use client";

import { useCallback } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { usePeriod } from "@/hooks/use-period";

const AS_OF = "Mar 15, 2026";
const DATA_RANGE = { start: "Mar 10, 2026", end: "Mar 16, 2026" };

// Mock data
const dpdDistribution = [
  { date: "Oct", current: 17500, dpd1_30: 1200, dpd31_60: 450, dpd61_90: 180, dpd90plus: 120 },
  { date: "Nov", current: 18100, dpd1_30: 1250, dpd31_60: 470, dpd61_90: 190, dpd90plus: 130 },
  { date: "Dec", current: 18900, dpd1_30: 1350, dpd31_60: 500, dpd61_90: 200, dpd90plus: 140 },
  { date: "Jan", current: 19500, dpd1_30: 1400, dpd31_60: 520, dpd61_90: 210, dpd90plus: 150 },
  { date: "Feb", current: 20100, dpd1_30: 1380, dpd31_60: 510, dpd61_90: 205, dpd90plus: 155 },
  { date: "Mar", current: 20800, dpd1_30: 1320, dpd31_60: 490, dpd61_90: 195, dpd90plus: 160 },
];

const delinquencyRate = [
  { date: "Oct", rate30plus: 4.8, rate60plus: 1.5, rate90plus: 0.6 },
  { date: "Nov", rate30plus: 4.9, rate60plus: 1.6, rate90plus: 0.6 },
  { date: "Dec", rate30plus: 5.2, rate60plus: 1.7, rate90plus: 0.7 },
  { date: "Jan", rate30plus: 5.1, rate60plus: 1.6, rate90plus: 0.7 },
  { date: "Feb", rate30plus: 4.9, rate60plus: 1.5, rate90plus: 0.7 },
  { date: "Mar", rate30plus: 4.7, rate60plus: 1.4, rate90plus: 0.7 },
];

const flowRates = [
  { from: "Current", to_1_30: 1320, stayed: 20800 },
  { from: "1-30 DPD", to_31_60: 490, cured: 830, stayed: 0 },
  { from: "31-60 DPD", to_61_90: 195, cured: 295, stayed: 0 },
  { from: "61-90 DPD", to_90plus: 160, cured: 35, stayed: 0 },
];

const collectionsEffectiveness = [
  { date: "Oct", contacted: 1200, cured: 720 },
  { date: "Nov", contacted: 1250, cured: 700 },
  { date: "Dec", contacted: 1350, cured: 750 },
  { date: "Jan", contacted: 1400, cured: 800 },
  { date: "Feb", contacted: 1380, cured: 810 },
  { date: "Mar", contacted: 1320, cured: 830 },
];

const writeOffTrend = [
  { date: "Oct", amount: 850000000 },
  { date: "Nov", amount: 920000000 },
  { date: "Dec", amount: 980000000 },
  { date: "Jan", amount: 1050000000 },
  { date: "Feb", amount: 1020000000 },
  { date: "Mar", amount: 990000000 },
];

const actionItems: ActionItem[] = [
  {
    id: "risk-1",
    priority: "positive",
    action: "30+ DPD rate declining to 4.7%.",
    detail: "Down from 5.2% peak in Dec. Collections effectiveness improving with cure rate at 62.9%.",
  },
  {
    id: "risk-2",
    priority: "urgent",
    action: "90+ DPD accounts still growing at 0.7%.",
    detail: "Flow rate from 61-90 to 90+ needs attention. Consider accelerated recovery strategies for this bucket.",
  },
  {
    id: "risk-3",
    priority: "monitor",
    action: "Write-off amounts plateauing near Rp 1B/month.",
    detail: "Monitor vintage performance to identify if specific cohorts are driving losses disproportionately.",
  },
];

export default function RiskPage() {
  const { periodLabel } = usePeriod();

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Risk Deep Dive</h1>
        <p className="text-sm text-slate-400 mt-1">{periodLabel}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="risk_dpd30plus_rate"
          label="30+ DPD Rate"
          value={4.7}
          prevValue={4.9}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          sparklineData={delinquencyRate.map((d) => d.rate30plus)}
          target={4.0}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="risk_dpd90plus_rate"
          label="90+ DPD Rate"
          value={0.7}
          prevValue={0.7}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="risk_exposure_at_risk"
          label="Exposure at Risk (30+ DPD)"
          value={28500000000}
          prevValue={29200000000}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="risk_writeoff"
          label="Write-offs (Period)"
          value={990000000}
          prevValue={1020000000}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
      </div>

      {/* DPD Distribution */}
      <ChartCard
        title="DPD Distribution"
        subtitle="Accounts by aging bucket over time"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardBarChart
          data={dpdDistribution}
          bars={[
            { key: "current", color: "#22c55e", label: "Current" },
            { key: "dpd1_30", color: "#f59e0b", label: "1-30 DPD" },
            { key: "dpd31_60", color: "#f97316", label: "31-60 DPD" },
            { key: "dpd61_90", color: "#ef4444", label: "61-90 DPD" },
            { key: "dpd90plus", color: "#991b1b", label: "90+ DPD" },
          ]}
          stacked
          height={320}
        />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Delinquency Rate Trend */}
        <ChartCard
          title="Delinquency Rate Trend"
          subtitle="% of accounts by DPD threshold"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={delinquencyRate}
            lines={[
              { key: "rate30plus", color: "#f59e0b", label: "30+ DPD %" },
              { key: "rate60plus", color: "#ef4444", label: "60+ DPD %" },
              { key: "rate90plus", color: "#991b1b", label: "90+ DPD %" },
            ]}
            valueType="percent"
            height={280}
          />
        </ChartCard>

        {/* Collections Effectiveness */}
        <ChartCard
          title="Collections Effectiveness"
          subtitle="Contacted vs Cured accounts"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={collectionsEffectiveness}
            bars={[
              { key: "contacted", color: "#475569", label: "Contacted" },
              { key: "cured", color: "#22c55e", label: "Cured" },
            ]}
            height={280}
          />
        </ChartCard>
      </div>

      {/* Flow rates table */}
      <ChartCard
        title="DPD Flow Rates"
        subtitle="Account movement between DPD buckets (this period)"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">From Bucket</th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">Rolled Forward</th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">Cured</th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">Stayed</th>
              </tr>
            </thead>
            <tbody>
              {flowRates.map((row) => (
                <tr key={row.from} className="border-b border-slate-800">
                  <td className="py-2 px-3 text-slate-300">{row.from}</td>
                  <td className="py-2 px-3 text-red-400 text-right font-medium">
                    {(row.from === "Current" ? row.to_1_30 : row.from === "1-30 DPD" ? row.to_31_60 : row.from === "31-60 DPD" ? row.to_61_90 : row.to_90plus)?.toLocaleString() ?? "-"}
                  </td>
                  <td className="py-2 px-3 text-emerald-400 text-right font-medium">
                    {row.cured?.toLocaleString() ?? "-"}
                  </td>
                  <td className="py-2 px-3 text-slate-300 text-right">
                    {row.stayed > 0 ? row.stayed.toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Write-off Trend */}
      <ChartCard
        title="Write-off Trend"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={writeOffTrend}
          lines={[{ key: "amount", color: "#ef4444", label: "Write-off Amount" }]}
          valueType="currency"
          height={260}
        />
      </ChartCard>

      <ActionItems section="Risk" items={actionItems} />
    </div>
  );
}
