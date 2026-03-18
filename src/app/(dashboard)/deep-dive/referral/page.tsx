"use client";

import { useCallback, useMemo } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { getPeriodRange, scaleTrendData, scaleMetricValue, getPeriodInsightLabels } from "@/lib/period-data";
import { applyFilterToData, applyFilterToMetric } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 15, 2026";

// Mock data — Referral funnel trend (monthly)
const referralFunnelTrend = [
  { date: "Oct", started: 2180, approved: 1050 },
  { date: "Nov", started: 2320, approved: 1140 },
  { date: "Dec", started: 2050, approved: 980 },
  { date: "Jan", started: 2450, approved: 1280 },
  { date: "Feb", started: 2580, approved: 1340 },
  { date: "Mar", started: 2500, approved: 1280 },
];

// Mock data — Channel attribution
const channelAttribution = [
  { channel: "Organic", started: 1000, approved: 560 },
  { channel: "WhatsApp", started: 625, approved: 340 },
  { channel: "Instagram", started: 375, approved: 175 },
  { channel: "TikTok", started: 250, approved: 115 },
  { channel: "Other", started: 250, approved: 90 },
];

// Mock data — Weekly conversion rate trend
const conversionRateTrend = [
  { date: "Oct", rate: 48.2 },
  { date: "Nov", rate: 49.1 },
  { date: "Dec", rate: 47.8 },
  { date: "Jan", rate: 52.2 },
  { date: "Feb", rate: 51.9 },
  { date: "Mar", rate: 51.2 },
];

const actionItems: ActionItem[] = [
  {
    id: "ref-1",
    priority: "positive",
    action: "Referral conversion rate stabilized above 51%.",
    detail: "Conversion improved from 48.2% in Oct to 51.2% in Mar. Referral quality remains strong with organic channel leading at 56% conversion.",
  },
  {
    id: "ref-2",
    priority: "monitor",
    action: "WhatsApp referrals are the second-largest channel at 25% share.",
    detail: "Conversion rate of 54.4% is close to organic. Consider increasing WhatsApp sharing incentives to grow this high-converting channel.",
  },
  {
    id: "ref-3",
    priority: "urgent",
    action: "TikTok referral conversion is lowest at 46%.",
    detail: "Despite growing volume, TikTok referrals convert poorly. Investigate whether TikTok-sourced applicants meet credit criteria or if UX friction exists in the referral link flow.",
  },
  {
    id: "ref-4",
    priority: "monitor",
    action: "December dip in referrals started (2,050) warrants seasonal planning.",
    detail: "Holiday period depressed referral activity. Pre-load January campaigns to recover momentum faster next cycle.",
  },
];

export default function ReferralPage() {
  const { period, periodLabel, timeRangeMultiplier } = usePeriod();
  const { filters } = useFilters();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const periodFunnelTrend = useMemo(() => applyFilterToData(scaleTrendData(referralFunnelTrend, period), filters), [period, filters]);
  const periodChannelAttribution = useMemo(() => applyFilterToData(scaleTrendData(channelAttribution, period, "channel"), filters), [period, filters]);
  const periodConversionRate = useMemo(() => applyFilterToData(scaleTrendData(conversionRateTrend, period), filters), [period, filters]);

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const funnelTrendInsights = useMemo<ChartInsight[]>(() => [
    { text: `Referrals started grew from 2,180 (${p.firstLabel}) to 2,500 (${p.lastLabel}), a 14.68% increase over ${p.span}.`, type: "positive" },
    { text: `Approvals tracked proportionally, rising from 1,050 to 1,280, maintaining a healthy ~51% conversion throughout.`, type: "positive" },
    { text: `A mid-period dip to 2,050 started and 980 approved aligns with the December holiday slowdown in user acquisition activity.`, type: "neutral" },
    { text: `The Jan rebound to 2,450 started suggests pent-up demand after holidays. Seasonal referral incentives could smooth this trough.`, type: "hypothesis" },
  ], [p]);

  const channelInsights = useMemo<ChartInsight[]>(() => [
    { text: `Organic referrals dominate at 40% of volume (1,000 started) with the highest conversion rate at 56%, indicating strong word-of-mouth.`, type: "positive" },
    { text: `WhatsApp is the second-largest channel at 25% share with 54.4% conversion, nearly matching organic quality.`, type: "positive" },
    { text: `Instagram contributes 15% of referrals but converts at only 46.67%, suggesting lower-intent traffic from social browsing.`, type: "negative" },
    { text: `TikTok referrals (10% share) convert at 46% — the viral nature drives volume but applicant quality lags. Consider pre-qualification nudges in the TikTok referral landing page.`, type: "hypothesis" },
    { text: `The "Other" bucket at 10% includes email and direct link shares. Low conversion (36%) may reflect stale or mis-attributed links.`, type: "negative" },
  ], [p]);

  const conversionInsights = useMemo<ChartInsight[]>(() => [
    { text: `Conversion rate improved from 48.2% (${p.firstLabel}) to 51.2% (${p.lastLabel}), crossing the 50% threshold in January.`, type: "positive" },
    { text: `The 3pp improvement suggests referral program optimizations (promo codes, streamlined onboarding) are working.`, type: "positive" },
    { text: `December's 47.8% dip was the only period below 48%, likely driven by holiday applicants who started but didn't complete.`, type: "neutral" },
    { text: `Sustaining above 50% indicates the referral pipeline produces higher-quality applicants than paid channels — consider reallocating budget accordingly.`, type: "hypothesis" },
  ], [p]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="ref_started"
          label="Referrals Started"
          value={applyFilterToMetric(scaleMetricValue(2500, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(2580, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="ref_approved"
          label="Referrals Approved"
          value={applyFilterToMetric(scaleMetricValue(1280, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(1340, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="ref_conversion"
          label="Conversion Rate"
          value={applyFilterToMetric(scaleMetricValue(51.2, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(51.9, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          target={55}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="ref_top_source"
          label="Organic Share"
          value={applyFilterToMetric(scaleMetricValue(40, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(38, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Hero chart — Referral funnel trend */}
      <ChartCard
        title="Referral Funnel Trend"
        subtitle="Referrals started vs approved over time"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={periodFunnelTrend}
          lines={[
            { key: "started", color: "#3b82f6", label: "Started" },
            { key: "approved", color: "#22c55e", label: "Approved" },
          ]}
          height={300}
        />
        <ChartInsights insights={funnelTrendInsights} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Channel attribution */}
        <ChartCard
          title="Channel Attribution"
          subtitle="Referral volume and approvals by source"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={periodChannelAttribution}
            bars={[
              { key: "started", color: "#3b82f6", label: "Started" },
              { key: "approved", color: "#22c55e", label: "Approved" },
            ]}
            xAxisKey="channel"
            height={280}
          />
          <ChartInsights insights={channelInsights} />
        </ChartCard>

        {/* Weekly conversion rate */}
        <ChartCard
          title="Conversion Rate Trend"
          subtitle="% of referrals started that were approved"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={periodConversionRate}
            lines={[{ key: "rate", color: "#8b5cf6", label: "Conversion Rate %" }]}
            valueType="percent"
            height={280}
          />
          <ChartInsights insights={conversionInsights} />
        </ChartCard>
      </div>

      {/* Action items */}
      <ActionItems section="Referral Program" items={actionItems} />
    </div>
  );
}
