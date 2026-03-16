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
const activationRateTrend = [
  { date: "Oct", rate: 58.2 },
  { date: "Nov", rate: 60.5 },
  { date: "Dec", rate: 62.1 },
  { date: "Jan", rate: 59.8 },
  { date: "Feb", rate: 63.4 },
  { date: "Mar", rate: 65.2 },
];

const avgDaysToFirstTxn = [
  { date: "Oct", days: 5.8 },
  { date: "Nov", days: 5.5 },
  { date: "Dec", days: 4.9 },
  { date: "Jan", days: 5.2 },
  { date: "Feb", days: 4.8 },
  { date: "Mar", days: 4.5 },
];

const dormancy = [
  { bucket: "No txn 7d", percent: 22.5 },
  { bucket: "No txn 14d", percent: 18.3 },
  { bucket: "No txn 30d", percent: 14.1 },
  { bucket: "No txn 60d", percent: 9.8 },
  { bucket: "No txn 90d", percent: 6.2 },
];

const activationByProduct = [
  { product: "Standard CC", activated: 2100, total: 2800 },
  { product: "Prepaid", activated: 620, total: 900 },
  { product: "Opening Fee", activated: 380, total: 500 },
];

const deliveryToActivation = [
  { days: "0-1", count: 850 },
  { days: "2-3", count: 1200 },
  { days: "4-7", count: 680 },
  { days: "8-14", count: 420 },
  { days: "15-30", count: 180 },
  { days: "30+", count: 70 },
];

const actionItems: ActionItem[] = [
  {
    id: "act-1",
    priority: "positive",
    action: "Activation rate hit 65.2%, a 6-month high.",
    detail: "Avg days to first transaction down to 4.5 days. Push notification campaigns appear effective.",
  },
  {
    id: "act-2",
    priority: "monitor",
    action: "22.5% of accounts inactive within 7 days.",
    detail: "Consider targeted welcome offers or onboarding nudges for accounts that haven't transacted in first week.",
  },
  {
    id: "act-3",
    priority: "urgent",
    action: "Prepaid activation rate is lowest at 68.9%.",
    detail: "Prepaid card users may not understand value prop. Investigate UX and consider first-load bonus.",
  },
];

export default function ActivationPage() {
  const { periodLabel } = usePeriod();

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Activation Deep Dive</h1>
        <p className="text-sm text-slate-400 mt-1">{periodLabel}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="act_activation_rate"
          label="Activation Rate (7d)"
          value={65.2}
          prevValue={63.4}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={activationRateTrend.map((d) => d.rate)}
          target={70}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="act_cards_activated"
          label="Cards Activated"
          value={3100}
          prevValue={2850}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="act_avg_days"
          label="Avg Days to First Txn"
          value={4.5}
          prevValue={4.8}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="act_dormant_30d"
          label="Dormant 30d+"
          value={14.1}
          prevValue={15.2}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Hero chart */}
      <ChartCard
        title="New Customer Activation Rate"
        subtitle="% making first purchase within 7 days of card delivery"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={activationRateTrend}
          lines={[{ key: "rate", color: "#22c55e", label: "Activation Rate %" }]}
          valueType="percent"
          height={300}
        />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Avg Days to First Transaction"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={avgDaysToFirstTxn}
            lines={[{ key: "days", color: "#f59e0b", label: "Avg Days" }]}
            height={280}
          />
        </ChartCard>

        <ChartCard
          title="Dormancy Analysis"
          subtitle="% of accounts with no transaction by period"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={dormancy}
            bars={[{ key: "percent", color: "#ef4444", label: "% Dormant" }]}
            xAxisKey="bucket"
            height={280}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Activation by Product Type"
          subtitle="Activated vs total by product"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={activationByProduct}
            bars={[
              { key: "total", color: "#475569", label: "Total" },
              { key: "activated", color: "#22c55e", label: "Activated" },
            ]}
            xAxisKey="product"
            height={280}
          />
        </ChartCard>

        <ChartCard
          title="Card Delivery to Activation Timeline"
          subtitle="Distribution of days from delivery to first transaction"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={deliveryToActivation}
            bars={[{ key: "count", color: "#8b5cf6", label: "Accounts" }]}
            xAxisKey="days"
            height={280}
          />
        </ChartCard>
      </div>

      <ActionItems section="Activation" items={actionItems} />
    </div>
  );
}
