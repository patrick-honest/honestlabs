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
const contactRateTrend = [
  { date: "Oct", rate: 82.1 },
  { date: "Nov", rate: 83.5 },
  { date: "Dec", rate: 80.2 },
  { date: "Jan", rate: 85.0 },
  { date: "Feb", rate: 86.3 },
  { date: "Mar", rate: 87.1 },
];

const ptpRateTrend = [
  { date: "Oct", rate: 45.2 },
  { date: "Nov", rate: 46.8 },
  { date: "Dec", rate: 43.5 },
  { date: "Jan", rate: 48.1 },
  { date: "Feb", rate: 49.5 },
  { date: "Mar", rate: 50.2 },
];

const cureRateTrend = [
  { date: "Oct", rate: 58.5 },
  { date: "Nov", rate: 56.0 },
  { date: "Dec", rate: 55.6 },
  { date: "Jan", rate: 57.1 },
  { date: "Feb", rate: 58.7 },
  { date: "Mar", rate: 62.9 },
];

const recoveryAmounts = [
  { date: "Oct", amount: 2800000000 },
  { date: "Nov", amount: 3100000000 },
  { date: "Dec", amount: 2900000000 },
  { date: "Jan", amount: 3300000000 },
  { date: "Feb", amount: 3500000000 },
  { date: "Mar", amount: 3800000000 },
];

const agentPerformance = [
  { agent: "Agent A", contacted: 320, ptp: 160, cured: 105, cureRate: 65.6 },
  { agent: "Agent B", contacted: 290, ptp: 140, cured: 88, cureRate: 62.9 },
  { agent: "Agent C", contacted: 310, ptp: 155, cured: 95, cureRate: 61.3 },
  { agent: "Agent D", contacted: 275, ptp: 125, cured: 72, cureRate: 57.6 },
  { agent: "Agent E", contacted: 260, ptp: 118, cured: 65, cureRate: 55.1 },
];

const actionItems: ActionItem[] = [
  {
    id: "coll-1",
    priority: "positive",
    action: "Cure rate improved to 62.9%, highest in 6 months.",
    detail: "Contact rate also trending up to 87.1%. Recovery amounts growing month over month.",
  },
  {
    id: "coll-2",
    priority: "monitor",
    action: "Promise-to-pay conversion still below 55%.",
    detail: "Consider revising scripts or offering structured payment plans for higher PTP conversion.",
  },
  {
    id: "coll-3",
    priority: "urgent",
    action: "Agent D and E cure rates below 60%.",
    detail: "Performance gap vs top agents suggests coaching opportunity. Review call recordings and approach.",
  },
];

export default function CollectionsPage() {
  const { periodLabel } = usePeriod();

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Collections Deep Dive</h1>
        <p className="text-sm text-slate-400 mt-1">{periodLabel}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="coll_contact_rate"
          label="Contact Rate"
          value={87.1}
          prevValue={86.3}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={contactRateTrend.map((d) => d.rate)}
          target={90}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="coll_ptp_rate"
          label="Promise-to-Pay Rate"
          value={50.2}
          prevValue={49.5}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          target={55}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="coll_cure_rate"
          label="Cure Rate"
          value={62.9}
          prevValue={58.7}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={cureRateTrend.map((d) => d.rate)}
          target={65}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="coll_recovery"
          label="Recovery Amount"
          value={3800000000}
          prevValue={3500000000}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Contact Rate Trend"
          subtitle="% of delinquent accounts contacted"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={contactRateTrend}
            lines={[{ key: "rate", color: "#3b82f6", label: "Contact Rate %" }]}
            valueType="percent"
            height={240}
          />
        </ChartCard>

        <ChartCard
          title="PTP Rate Trend"
          subtitle="% that commit to paying"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={ptpRateTrend}
            lines={[{ key: "rate", color: "#f59e0b", label: "PTP Rate %" }]}
            valueType="percent"
            height={240}
          />
        </ChartCard>

        <ChartCard
          title="Cure Rate Trend"
          subtitle="% returning to current after collections"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={cureRateTrend}
            lines={[{ key: "rate", color: "#22c55e", label: "Cure Rate %" }]}
            valueType="percent"
            height={240}
          />
        </ChartCard>
      </div>

      {/* Recovery amounts */}
      <ChartCard
        title="Recovery Amounts"
        subtitle="Total collected from delinquent accounts"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardBarChart
          data={recoveryAmounts}
          bars={[{ key: "amount", color: "#22c55e", label: "Recovery Amount" }]}
          height={280}
        />
      </ChartCard>

      {/* Agent performance table */}
      <ChartCard
        title="Agent Performance"
        subtitle="From Freshworks data (placeholder)"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Agent</th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">Contacted</th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">PTP</th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">Cured</th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">Cure Rate</th>
              </tr>
            </thead>
            <tbody>
              {agentPerformance.map((row) => (
                <tr key={row.agent} className="border-b border-slate-800">
                  <td className="py-2 px-3 text-slate-300">{row.agent}</td>
                  <td className="py-2 px-3 text-white text-right">{row.contacted}</td>
                  <td className="py-2 px-3 text-white text-right">{row.ptp}</td>
                  <td className="py-2 px-3 text-white text-right">{row.cured}</td>
                  <td className={`py-2 px-3 text-right font-medium ${row.cureRate >= 60 ? "text-emerald-400" : "text-amber-400"}`}>
                    {row.cureRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ActionItems section="Collections" items={actionItems} />
    </div>
  );
}
