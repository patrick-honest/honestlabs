"use client";

import { useCallback } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { DashboardAreaChart } from "@/components/charts/area-chart";
import { usePeriod } from "@/hooks/use-period";

const AS_OF = "Mar 15, 2026";
const DATA_RANGE = { start: "Mar 10, 2026", end: "Mar 16, 2026" };

// Mock data
const spendActiveRateTrend = [
  { date: "Oct", rate: 42.5 },
  { date: "Nov", rate: 44.1 },
  { date: "Dec", rate: 48.3 },
  { date: "Jan", rate: 45.2 },
  { date: "Feb", rate: 46.8 },
  { date: "Mar", rate: 47.5 },
];

const eligibleVsTransactors = [
  { date: "Oct", eligible: 18500, transactors: 7863 },
  { date: "Nov", eligible: 19200, transactors: 8467 },
  { date: "Dec", eligible: 20100, transactors: 9708 },
  { date: "Jan", eligible: 21000, transactors: 9492 },
  { date: "Feb", eligible: 21800, transactors: 10202 },
  { date: "Mar", eligible: 22500, transactors: 10688 },
];

const spendByCategory = [
  { date: "Oct", online: 12000000000, offline: 8000000000, qris: 3000000000 },
  { date: "Nov", online: 13500000000, offline: 8500000000, qris: 3500000000 },
  { date: "Dec", online: 18000000000, offline: 11000000000, qris: 5000000000 },
  { date: "Jan", online: 14000000000, offline: 9000000000, qris: 4000000000 },
  { date: "Feb", online: 15000000000, offline: 9500000000, qris: 4500000000 },
  { date: "Mar", online: 16000000000, offline: 10000000000, qris: 5000000000 },
];

const avgSpendPerTxn = [
  { date: "Oct", online: 450000, offline: 380000, qris: 120000 },
  { date: "Nov", online: 460000, offline: 390000, qris: 125000 },
  { date: "Dec", online: 520000, offline: 420000, qris: 135000 },
  { date: "Jan", online: 470000, offline: 395000, qris: 130000 },
  { date: "Feb", online: 480000, offline: 400000, qris: 132000 },
  { date: "Mar", online: 490000, offline: 410000, qris: 138000 },
];

const totalSpendVolume = [
  { date: "Oct", volume: 23000000000 },
  { date: "Nov", volume: 25500000000 },
  { date: "Dec", volume: 34000000000 },
  { date: "Jan", volume: 27000000000 },
  { date: "Feb", volume: 29000000000 },
  { date: "Mar", volume: 31000000000 },
];

const txnPerEligible = [
  { date: "Oct", txnPerUser: 4.2 },
  { date: "Nov", txnPerUser: 4.5 },
  { date: "Dec", txnPerUser: 5.8 },
  { date: "Jan", txnPerUser: 4.6 },
  { date: "Feb", txnPerUser: 4.8 },
  { date: "Mar", txnPerUser: 5.0 },
];

const actionItems: ActionItem[] = [
  {
    id: "spend-1",
    priority: "positive",
    action: "Spend active rate reached 47.5%.",
    detail: "Highest in 6 months, driven by QRIS adoption growth and seasonal effects.",
  },
  {
    id: "spend-2",
    priority: "monitor",
    action: "QRIS spend growing faster than card spend.",
    detail: "QRIS now 16% of total volume, up from 13%. Monitor interchange revenue impact.",
  },
  {
    id: "spend-3",
    priority: "urgent",
    action: "Top merchant category data unavailable.",
    detail: "Merchant category code (MCC) enrichment pipeline needs to be connected for deeper spend analysis.",
  },
];

export default function SpendPage() {
  const { periodLabel } = usePeriod();

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Spend Deep Dive</h1>
        <p className="text-sm text-slate-400 mt-1">{periodLabel}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="spend_active_rate"
          label="Spend Active Rate"
          value={47.5}
          prevValue={46.8}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={spendActiveRateTrend.map((d) => d.rate)}
          target={55}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="spend_eligible"
          label="Eligible Accounts"
          value={22500}
          prevValue={21800}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="spend_total_volume"
          label="Total Spend Volume"
          value={31000000000}
          prevValue={29000000000}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="spend_txn_per_user"
          label="Txn per Eligible User"
          value={5.0}
          prevValue={4.8}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Spend Active Rate hero chart */}
      <ChartCard
        title="Spend Active Rate Trend"
        subtitle="% of eligible accounts with at least 1 transaction"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={spendActiveRateTrend}
          lines={[{ key: "rate", color: "#3b82f6", label: "Spend Active Rate %" }]}
          valueType="percent"
          height={300}
        />
      </ChartCard>

      {/* Two column charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Eligible vs Transactors"
          subtitle="Total eligible accounts vs those transacting"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={eligibleVsTransactors}
            bars={[
              { key: "eligible", color: "#475569", label: "Eligible" },
              { key: "transactors", color: "#3b82f6", label: "Transactors" },
            ]}
            height={280}
          />
        </ChartCard>

        <ChartCard
          title="Spend by Category"
          subtitle="Online / Offline / QRIS"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardAreaChart
            data={spendByCategory}
            areas={[
              { key: "online", color: "#3b82f6", label: "Online" },
              { key: "offline", color: "#8b5cf6", label: "Offline" },
              { key: "qris", color: "#06b6d4", label: "QRIS" },
            ]}
            valueType="currency"
            height={280}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Avg Spend per Transaction"
          subtitle="By category"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={avgSpendPerTxn}
            lines={[
              { key: "online", color: "#3b82f6", label: "Online" },
              { key: "offline", color: "#8b5cf6", label: "Offline" },
              { key: "qris", color: "#06b6d4", label: "QRIS" },
            ]}
            valueType="currency"
            height={260}
          />
        </ChartCard>

        <ChartCard
          title="Total Spend Volume"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={totalSpendVolume}
            bars={[{ key: "volume", color: "#3b82f6", label: "Total Volume" }]}
            height={260}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Transactions per Eligible User"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={txnPerEligible}
          lines={[{ key: "txnPerUser", color: "#f59e0b", label: "Txn / User" }]}
          height={260}
        />
      </ChartCard>

      {/* Top merchant categories placeholder */}
      <ChartCard
        title="Top Merchant Categories"
        subtitle="Merchant category data TBD -- pending MCC enrichment pipeline"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
      >
        <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
          Merchant category data not yet available. Connect MCC enrichment pipeline to enable.
        </div>
      </ChartCard>

      <ActionItems section="Spend" items={actionItems} />
    </div>
  );
}
