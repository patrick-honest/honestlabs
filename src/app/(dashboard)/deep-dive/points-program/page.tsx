"use client";

import { useMemo, useCallback } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { DashboardAreaChart } from "@/components/charts/area-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { getPeriodRange, scaleTrendData, scaleMetricValue, getPeriodInsightLabels } from "@/lib/period-data";
import { applyFilterToData, applyFilterToMetric } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 15, 2026";

// Mock data — Points awarded vs redeemed trend (monthly)
const pointsFlowTrend = [
  { date: "Oct", awarded: 186000000, redeemed: 152000000 },
  { date: "Nov", awarded: 201000000, redeemed: 168000000 },
  { date: "Dec", awarded: 178000000, redeemed: 149000000 },
  { date: "Jan", awarded: 215000000, redeemed: 182000000 },
  { date: "Feb", awarded: 224000000, redeemed: 189000000 },
  { date: "Mar", awarded: 210000000, redeemed: 173000000 },
];

// Mock data — Closing balance trend (monthly)
const closingBalanceTrend = [
  { date: "Oct", closing: 798000000 },
  { date: "Nov", closing: 812000000 },
  { date: "Dec", closing: 805000000 },
  { date: "Jan", closing: 828000000 },
  { date: "Feb", closing: 842000000 },
  { date: "Mar", closing: 842000000 },
];

// Mock data — Points distribution by bucket
const pointsDistribution = [
  { bucket: "0", account_count: 259700, pct: 70.0 },
  { bucket: "1-100", account_count: 29680, pct: 8.0 },
  { bucket: "101-500", account_count: 33390, pct: 9.0 },
  { bucket: "501-1K", account_count: 18550, pct: 5.0 },
  { bucket: "1K-5K", account_count: 22260, pct: 6.0 },
  { bucket: "5K+", account_count: 7420, pct: 2.0 },
];

// Mock data — Expiry trend (monthly)
const expiryTrend = [
  { date: "Oct", expired: 2100000 },
  { date: "Nov", expired: 1800000 },
  { date: "Dec", expired: 3200000 },
  { date: "Jan", expired: 2400000 },
  { date: "Feb", expired: 1900000 },
  { date: "Mar", expired: 61000000 },
];

const actionItems: ActionItem[] = [
  {
    id: "pts-1",
    priority: "urgent",
    action: "High point liability (~842M outstanding) -- monitor for balance sheet impact.",
    detail:
      "Total closing points balance has been steadily growing. Work with finance to ensure adequate provisioning and consider whether redemption incentives should be increased to manage liability.",
  },
  {
    id: "pts-2",
    priority: "positive",
    action: "Redemption rate healthy at ~82% -- good engagement signal.",
    detail:
      "Customers are actively redeeming points, indicating the rewards catalog is attractive. Maintain current redemption options and monitor for any drop-off.",
  },
  {
    id: "pts-3",
    priority: "monitor",
    action: "Batch expiry of 61M points in March -- check customer communication.",
    detail:
      "A large batch of points expired this month, significantly above the ~2M monthly average. Verify that affected customers received advance notification and consider a grace period policy for future batch expiries.",
  },
  {
    id: "pts-4",
    priority: "monitor",
    action: "70% of accounts have 0 points -- dormant user engagement opportunity.",
    detail:
      "The majority of accounts carry no points balance. This segment likely includes inactive cardholders. Cross-reference with activation data to identify re-engagement campaigns targeting dormant users.",
  },
];

export default function PointsProgramPage() {
  const { period, periodLabel, timeRangeMultiplier } = usePeriod();
  const { filters } = useFilters();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const periodFlowTrend = useMemo(
    () => applyFilterToData(scaleTrendData(pointsFlowTrend, period), filters),
    [period, filters],
  );
  const periodClosingTrend = useMemo(
    () => applyFilterToData(scaleTrendData(closingBalanceTrend, period), filters),
    [period, filters],
  );
  const periodDistribution = useMemo(
    () => applyFilterToData(scaleTrendData(pointsDistribution, period, "bucket"), filters),
    [period, filters],
  );
  const periodExpiryTrend = useMemo(
    () => applyFilterToData(scaleTrendData(expiryTrend, period), filters),
    [period, filters],
  );

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const flowTrendInsights = useMemo<ChartInsight[]>(
    () => [
      {
        text: `Points awarded ranged from 178M to 224M per month over ${p.span}, peaking in February at 224M.`,
        type: "neutral",
      },
      {
        text: `Redemptions tracked closely at 80-85% of awarded volume, indicating strong customer engagement with the rewards program.`,
        type: "positive",
      },
      {
        text: `December saw the lowest award/redeem activity (178M/149M), consistent with seasonal spending patterns during the holiday period.`,
        type: "neutral",
      },
      {
        text: `If redemption rate drops below 75%, investigate whether catalog freshness or point-to-value ratio has degraded.`,
        type: "hypothesis",
      },
    ],
    [p],
  );

  const closingBalanceInsights = useMemo<ChartInsight[]>(
    () => [
      {
        text: `Total points outstanding grew from 798M (${p.firstLabel}) to 842M (${p.lastLabel}), a 5.51% increase representing growing liability.`,
        type: "negative",
      },
      {
        text: `The balance plateaued at 842M in the latest two periods, possibly due to the large March expiry event offsetting new awards.`,
        type: "neutral",
      },
      {
        text: `Consider setting a target ceiling (e.g., 900M) and triggering proactive redemption campaigns when liability approaches that threshold.`,
        type: "hypothesis",
      },
    ],
    [p],
  );

  const distributionInsights = useMemo<ChartInsight[]>(
    () => [
      {
        text: `70% of accounts hold zero points, representing a large dormant segment that could benefit from targeted earn incentives.`,
        type: "negative",
      },
      {
        text: `The 1K-5K and 5K+ buckets together hold only 8% of accounts but likely represent a disproportionate share of total liability.`,
        type: "neutral",
      },
      {
        text: `Nudge the 1-100 point segment (8% of accounts) toward their first redemption to build the rewards habit loop.`,
        type: "hypothesis",
      },
    ],
    [],
  );

  const expiryInsights = useMemo<ChartInsight[]>(
    () => [
      {
        text: `March saw a massive 61M point expiry, roughly 30x the typical monthly average of ~2M, driven by a batch expiry event.`,
        type: "negative",
      },
      {
        text: `Regular monthly expiry of 1.8-3.2M points is healthy and expected as part of the standard 12-month expiry policy.`,
        type: "neutral",
      },
      {
        text: `Introduce a "points expiring soon" push notification 30 days before expiry to drive pre-emptive redemption and reduce customer complaints.`,
        type: "hypothesis",
      },
    ],
    [],
  );

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Points Program Deep Dive
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{periodLabel}</p>
      </div>

      <ActiveFiltersBanner />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="pts_outstanding"
          label="Total Points Outstanding"
          value={applyFilterToMetric(scaleMetricValue(842000000, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(842000000, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="pts_holders"
          label="Active Point Holders"
          value={applyFilterToMetric(scaleMetricValue(112000, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(108000, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="pts_redemption_rate"
          label="Redemption Rate"
          value={applyFilterToMetric(scaleMetricValue(82.38, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(84.38, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          target={85}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="pts_expired"
          label="Points Expired This Period"
          value={applyFilterToMetric(scaleMetricValue(61000000, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(1900000, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Hero chart — Points awarded vs redeemed */}
      <ChartCard
        title="Points Awarded vs Redeemed"
        subtitle="Monthly points flow — redeemed shown as positive (absolute value)"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={periodFlowTrend}
          lines={[
            { key: "awarded", color: "#3b82f6", label: "Awarded" },
            { key: "redeemed", color: "#f59e0b", label: "Redeemed" },
          ]}
          height={300}
        />
        <ChartInsights insights={flowTrendInsights} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Closing balance trend */}
        <ChartCard
          title="Points Liability (Closing Balance)"
          subtitle="Total outstanding points balance over time"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardAreaChart
            data={periodClosingTrend}
            areas={[{ key: "closing", color: "#8b5cf6", label: "Closing Balance" }]}
            height={280}
          />
          <ChartInsights insights={closingBalanceInsights} />
        </ChartCard>

        {/* Points distribution by bucket */}
        <ChartCard
          title="Points Distribution by Bucket"
          subtitle="Account count by closing points balance range"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={periodDistribution}
            bars={[{ key: "account_count", color: "#22c55e", label: "Accounts" }]}
            xAxisKey="bucket"
            height={280}
          />
          <ChartInsights insights={distributionInsights} />
        </ChartCard>
      </div>

      {/* Expiry trend */}
      <ChartCard
        title="Points Expiry Trend"
        subtitle="Monthly expired points volume"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={periodExpiryTrend}
          lines={[{ key: "expired", color: "#ef4444", label: "Expired" }]}
          height={280}
        />
        <ChartInsights insights={expiryInsights} />
      </ChartCard>

      {/* Action items */}
      <ActionItems section="Points Program" items={actionItems} />
    </div>
  );
}
