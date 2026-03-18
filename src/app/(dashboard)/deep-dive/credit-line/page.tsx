"use client";

import { useCallback, useMemo } from "react";
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

// Mock data — CLI volume trend (monthly)
const cliVolumeTrend = [
  { date: "Oct", count: 7800, uniqueUsers: 5700 },
  { date: "Nov", count: 8100, uniqueUsers: 5900 },
  { date: "Dec", count: 7500, uniqueUsers: 5400 },
  { date: "Jan", count: 8800, uniqueUsers: 6400 },
  { date: "Feb", count: 8900, uniqueUsers: 6500 },
  { date: "Mar", count: 8500, uniqueUsers: 6200 },
];

// Mock data — Avg increase trend (monthly, IDR)
const avgIncreaseTrend = [
  { date: "Oct", avgIncrease: 2200000 },
  { date: "Nov", avgIncrease: 2300000 },
  { date: "Dec", avgIncrease: 2150000 },
  { date: "Jan", avgIncrease: 2450000 },
  { date: "Feb", avgIncrease: 2550000 },
  { date: "Mar", avgIncrease: 2500000 },
];

// Mock data — Update type breakdown
const updateTypeBreakdown = [
  { type: "Automatic", count: 5100, avgIncrease: 2100000 },
  { type: "Manual Review", count: 2125, avgIncrease: 3200000 },
  { type: "Promotional", count: 1275, avgIncrease: 2800000 },
];

// Mock data — CLI distribution by amount bucket
const cliDistribution = [
  { bucket: "< 1M", count: 1200 },
  { bucket: "1M–2M", count: 2400 },
  { bucket: "2M–3M", count: 2800 },
  { bucket: "3M–5M", count: 1500 },
  { bucket: "5M+", count: 600 },
];

const actionItems: ActionItem[] = [
  {
    id: "cli-1",
    priority: "positive",
    action: "CLI volume averaging 8,500/month with 6,200 unique recipients.",
    detail: "Healthy repeat CLI rate (~27% of CLIs go to users who received prior increases) indicates the scoring engine is progressively rewarding good behavior.",
  },
  {
    id: "cli-2",
    priority: "positive",
    action: "Automatic CLIs account for 60% of volume.",
    detail: "High automation rate reduces operational burden. Avg increase for auto CLIs (IDR 2.1M) is appropriately conservative versus manual (IDR 3.2M).",
  },
  {
    id: "cli-3",
    priority: "monitor",
    action: "Avg increase of IDR 2.5M is at the upper end of risk appetite.",
    detail: "Monitor delinquency rates for accounts that received CLIs in the past 90 days. If Bucket 1 entry rate exceeds 5%, consider tightening thresholds.",
  },
  {
    id: "cli-4",
    priority: "urgent",
    action: "Promotional CLIs (15%) need ROI validation.",
    detail: "Promotional increases average IDR 2.8M but lack spend-lift tracking. Implement a control group to measure incremental revenue from promotional CLI campaigns.",
  },
];

export default function CreditLinePage() {
  const { period, periodLabel, timeRangeMultiplier } = usePeriod();
  const { filters } = useFilters();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const periodVolumeTrend = useMemo(() => applyFilterToData(scaleTrendData(cliVolumeTrend, period), filters), [period, filters]);
  const periodAvgIncrease = useMemo(() => applyFilterToData(scaleTrendData(avgIncreaseTrend, period), filters), [period, filters]);
  const periodUpdateType = useMemo(() => applyFilterToData(scaleTrendData(updateTypeBreakdown, period, "type"), filters), [period, filters]);
  const periodDistribution = useMemo(() => applyFilterToData(scaleTrendData(cliDistribution, period, "bucket"), filters), [period, filters]);

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const volumeInsights = useMemo<ChartInsight[]>(() => [
    { text: `CLI volume grew from 7,800 (${p.firstLabel}) to 8,500 (${p.lastLabel}), a 8.97% increase over ${p.span}.`, type: "positive" },
    { text: `Unique recipients followed a similar trajectory (5,700 to 6,200), indicating broad distribution rather than repeat increases to the same users.`, type: "positive" },
    { text: `December dip to 7,500 CLIs reflects seasonal conservatism — fewer automatic triggers fire during holiday spending volatility.`, type: "neutral" },
    { text: `The gap between total CLIs and unique users (~27%) represents repeat increases, likely driven by progressive limit policies for well-performing accounts.`, type: "hypothesis" },
  ], [p]);

  const avgIncreaseInsights = useMemo<ChartInsight[]>(() => [
    { text: `Average CLI amount rose from IDR 2.2M (${p.firstLabel}) to IDR 2.5M (${p.lastLabel}), a 13.64% increase in ${p.span}.`, type: "positive" },
    { text: `The upward trend suggests the portfolio is maturing — longer-tenured accounts qualify for larger increases as payment history builds.`, type: "positive" },
    { text: `December's dip to IDR 2.15M aligns with more conservative automatic triggers during the holiday risk window.`, type: "neutral" },
    { text: `If average increases continue rising without corresponding utilization growth, the gap between limit and usage could widen — monitor utilization rate alongside CLI volume.`, type: "hypothesis" },
  ], [p]);

  const updateTypeInsights = useMemo<ChartInsight[]>(() => [
    { text: `Automatic CLIs dominate at 60% (5,100 of 8,500), reflecting mature scoring automation that reduces manual workload.`, type: "positive" },
    { text: `Manual Review CLIs average IDR 3.2M — 52% higher than automatic (IDR 2.1M), appropriate for cases requiring human judgment.`, type: "neutral" },
    { text: `Promotional CLIs at 15% (1,275) average IDR 2.8M. Without spend-lift measurement, ROI on these campaigns is unverified.`, type: "negative" },
    { text: `The 60/25/15 split is healthy. If promotional share exceeds 20% without ROI evidence, the program risks inflating limits without revenue benefit.`, type: "hypothesis" },
  ], [p]);

  const distributionInsights = useMemo<ChartInsight[]>(() => [
    { text: `The IDR 2M-3M bucket is the largest at 2,800 CLIs (32.94%), aligning with the portfolio's middle-income segment sweet spot.`, type: "neutral" },
    { text: `1,200 CLIs below IDR 1M (14.12%) likely represent small automatic step-ups for newer or lower-limit accounts.`, type: "neutral" },
    { text: `The IDR 5M+ bucket at 600 CLIs (7.06%) represents high-value increases — these accounts should be monitored for concentration risk.`, type: "negative" },
    { text: `Distribution is right-skewed as expected — the bulk of increases are moderate (1M-3M) with a long tail of larger increases for qualified accounts.`, type: "positive" },
    { text: `Capping the 5M+ bucket at 10% of total CLIs provides a natural risk guardrail without overly restricting high-performing accounts.`, type: "hypothesis" },
  ], [p]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Credit Line Increases Deep Dive</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{periodLabel}</p>
      </div>

      <ActiveFiltersBanner />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="cli_issued"
          label="CLIs Issued"
          value={applyFilterToMetric(scaleMetricValue(8500, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(8900, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="cli_avg_increase"
          label="Avg Increase"
          value={applyFilterToMetric(2500000, filters, false)}
          prevValue={applyFilterToMetric(2550000, filters, false)}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="cli_unique_recipients"
          label="Unique Recipients"
          value={applyFilterToMetric(scaleMetricValue(6200, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(6500, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="cli_auto_rate"
          label="Auto CLI Rate"
          value={applyFilterToMetric(scaleMetricValue(60.0, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(58.5, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          target={65}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Hero chart — CLI volume trend */}
      <ChartCard
        title="CLI Volume Trend"
        subtitle="Total CLIs issued and unique recipients over time"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={periodVolumeTrend}
          lines={[
            { key: "count", color: "#3b82f6", label: "CLIs Issued" },
            { key: "uniqueUsers", color: "#22c55e", label: "Unique Users" },
          ]}
          height={300}
        />
        <ChartInsights insights={volumeInsights} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Avg increase trend (area chart) */}
        <ChartCard
          title="Average CLI Amount Trend"
          subtitle="Mean credit line increase per period (IDR)"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardAreaChart
            data={periodAvgIncrease}
            areas={[{ key: "avgIncrease", color: "#8b5cf6", label: "Avg Increase (IDR)" }]}
            valueType="currency"
            height={280}
          />
          <ChartInsights insights={avgIncreaseInsights} />
        </ChartCard>

        {/* Update type breakdown */}
        <ChartCard
          title="CLI by Update Type"
          subtitle="Automatic, manual review, and promotional breakdown"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={periodUpdateType}
            bars={[
              { key: "count", color: "#3b82f6", label: "CLI Count" },
            ]}
            xAxisKey="type"
            height={280}
          />
          <ChartInsights insights={updateTypeInsights} />
        </ChartCard>
      </div>

      {/* CLI distribution by amount */}
      <ChartCard
        title="CLI Distribution by Amount"
        subtitle="Number of credit line increases by IDR amount bucket"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardBarChart
          data={periodDistribution}
          bars={[{ key: "count", color: "#06b6d4", label: "CLI Count" }]}
          xAxisKey="bucket"
          height={300}
        />
        <ChartInsights insights={distributionInsights} />
      </ChartCard>

      {/* Action items */}
      <ActionItems section="Credit Line Increases" items={actionItems} />
    </div>
  );
}
