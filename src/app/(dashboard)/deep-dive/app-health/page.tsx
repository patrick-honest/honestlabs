"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { DashboardAreaChart } from "@/components/charts/area-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { getPeriodRange, scaleTrendData, scaleMetricValue, getPeriodInsightLabels } from "@/lib/period-data";
import { applyFilterToData, applyFilterToMetric } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const AS_OF = "Mar 15, 2026";

// Mock data — Active users trend
const activeUsersTrend = [
  { date: "Oct", dau: 38500, wau: 105000, mau: 245000 },
  { date: "Nov", dau: 40200, wau: 110000, mau: 255000 },
  { date: "Dec", dau: 44800, wau: 118000, mau: 268000 },
  { date: "Jan", dau: 42100, wau: 112000, mau: 272000 },
  { date: "Feb", dau: 43500, wau: 116000, mau: 278000 },
  { date: "Mar", dau: 45200, wau: 120000, mau: 285000 },
];

// Mock data — Session metrics
const sessionMetrics = [
  { date: "Oct", avgScreens: 7.8, avgDuration: 245 },
  { date: "Nov", avgScreens: 8.0, avgDuration: 252 },
  { date: "Dec", avgScreens: 8.6, avgDuration: 278 },
  { date: "Jan", avgScreens: 8.2, avgDuration: 260 },
  { date: "Feb", avgScreens: 8.4, avgDuration: 268 },
  { date: "Mar", avgScreens: 8.7, avgDuration: 275 },
];

// Mock data — Top screens
const topScreens = [
  { screen: "home_default", views: 2979000 },
  { screen: "pay_bill_amount", views: 622000 },
  { screen: "scan_qr", views: 310000 },
  { screen: "statement_default", views: 470000 },
  { screen: "reward_screen", views: 403000 },
  { screen: "menu", views: 560000 },
  { screen: "unlock_biometrics", views: 1243000 },
  { screen: "savings_home", views: 95000 },
  { screen: "prepaid_add_funds", views: 118000 },
  { screen: "authorize_txn", views: 125000 },
];

// Mock data — Feature adoption rates
const featureAdoption = [
  { feature: "QRIS Scan", rate: 27.4 },
  { feature: "Bill Pay", rate: 68.2 },
  { feature: "Rewards", rate: 45.8 },
  { feature: "Savings Acct", rate: 18.5 },
  { feature: "Tap to Pay", rate: 12.3 },
  { feature: "Biometric Login", rate: 72.1 },
  { feature: "Push Notifs", rate: 58.6 },
  { feature: "Prepaid Top-up", rate: 15.2 },
];

// Mock data — Error rate trend
const errorRateTrend = [
  { date: "Oct", rate: 1.8 },
  { date: "Nov", rate: 1.5 },
  { date: "Dec", rate: 1.3 },
  { date: "Jan", rate: 1.4 },
  { date: "Feb", rate: 1.2 },
  { date: "Mar", rate: 1.1 },
];

const actionItems: ActionItem[] = [
  {
    id: "app-1",
    priority: "positive",
    action: "DAU/MAU ratio at 15.9%, indicating healthy daily engagement.",
    detail: "Industry benchmark for fintech apps in SEA is 12-18%. Honest is in the upper range.",
  },
  {
    id: "app-2",
    priority: "positive",
    action: "Error rate dropped to 1.1%, lowest in 6 months.",
    detail: "Continuous improvement in app stability. Target: below 1.0% by Q2 2026.",
  },
  {
    id: "app-3",
    priority: "monitor",
    action: "Savings account feature adoption at 18.5% — underperforming.",
    detail: "Consider in-app prompts or incentives to drive savings feature discovery.",
  },
  {
    id: "app-4",
    priority: "monitor",
    action: "Tap to Pay adoption at 12.3% — growth opportunity.",
    detail: "HCE/NFC support needs wider device compatibility and user education campaigns.",
  },
];

export default function AppHealthPage() {
  const { period, periodLabel, timeRangeMultiplier } = usePeriod();
  const { filters } = useFilters();
  const { dateParams } = useDateParams();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData } = useSWR(
    `/api/app-health?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  // ── API-backed data with mock fallbacks ──
  const apiActiveUsers = useMemo(() => {
    if (!apiData?.activeUsers?.length) return activeUsersTrend;
    return apiData.activeUsers.map((r: { week_start: string; dau: number; wau: number; mau: number }) => ({
      date: r.week_start,
      dau: r.dau,
      wau: r.wau,
      mau: r.mau,
    }));
  }, [apiData]);

  const apiSessionMetrics = useMemo(() => {
    if (!apiData?.sessionMetrics?.length) return sessionMetrics;
    return apiData.sessionMetrics.map((r: { week_start: string; avg_screens_per_session: number; avg_session_duration_sec: number; error_rate: number }) => ({
      date: r.week_start,
      avgScreens: r.avg_screens_per_session,
      avgDuration: r.avg_session_duration_sec,
    }));
  }, [apiData]);

  const apiErrorRate = useMemo(() => {
    if (!apiData?.sessionMetrics?.length) return errorRateTrend;
    return apiData.sessionMetrics.map((r: { week_start: string; error_rate: number }) => ({
      date: r.week_start,
      rate: r.error_rate,
    }));
  }, [apiData]);

  const apiTopScreens = useMemo(() => {
    if (!apiData?.topScreens?.length) return topScreens;
    return apiData.topScreens.map((r: { screen_name: string; view_count: number }) => ({
      screen: r.screen_name,
      views: r.view_count,
    }));
  }, [apiData]);

  const pActiveUsers = useMemo(() => applyFilterToData(scaleTrendData(apiActiveUsers, period), filters), [apiActiveUsers, period, filters]);
  const pSessionMetrics = useMemo(() => applyFilterToData(scaleTrendData(apiSessionMetrics, period), filters), [apiSessionMetrics, period, filters]);
  const pErrorRate = useMemo(() => applyFilterToData(scaleTrendData(apiErrorRate, period), filters), [apiErrorRate, period, filters]);

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const activeUsersInsights: ChartInsight[] = useMemo(() => [
    { text: `DAU reached 45.2K in ${p.lastLabel}, up 17.4% from ${p.firstLabel}.`, type: "positive" },
    { text: `WAU grew to 120K with a DAU/WAU ratio of 37.7%, indicating strong weekly retention.`, type: "positive" },
    { text: `MAU at 285K represents ~50% of total issued card base — room for reactivation campaigns.`, type: "neutral" },
    { text: `December spike correlates with holiday shopping — sustained growth in Q1 suggests organic adoption.`, type: "hypothesis" },
  ], [p]);

  const sessionInsights: ChartInsight[] = useMemo(() => [
    { text: `Avg screens per session increased to 8.7, indicating deeper feature exploration.`, type: "positive" },
    { text: `Session duration averaging ~4.6 minutes — healthy for a financial app.`, type: "neutral" },
    { text: `QRIS adoption is driving longer sessions as users navigate scan → amount → confirm flows.`, type: "hypothesis" },
  ], [p]);

  const featureInsights: ChartInsight[] = useMemo(() => [
    { text: `Biometric login at 72.1% — strongest feature adoption, reduces friction.`, type: "positive" },
    { text: `Bill Pay at 68.2% — primary engagement driver. Users who pay bills are 3x more likely to transact.`, type: "positive" },
    { text: `QRIS at 27.4% adoption and growing — aligns with national QR payment push.`, type: "neutral" },
    { text: `Savings & Tap to Pay under 20% — could benefit from onboarding flow integration.`, type: "hypothesis" },
  ], [p]);

  const errorInsights: ChartInsight[] = useMemo(() => [
    { text: `Error rate dropped from 1.8% to 1.1% over the ${p.span} — a 39% reduction.`, type: "positive" },
    { text: `Most errors concentrated in payment flows — QRIS and bill pay.`, type: "neutral" },
    { text: `Target: sub-1.0% error rate by Q2 2026 is achievable at current improvement pace.`, type: "hypothesis" },
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
          metricKey="app_dau"
          label="DAU"
          value={applyFilterToMetric(scaleMetricValue(45200, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(43500, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={pActiveUsers.map((d: Record<string, unknown>) => d.dau as number)}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="app_wau"
          label="WAU"
          value={applyFilterToMetric(scaleMetricValue(120000, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(116000, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="app_mau"
          label="MAU"
          value={applyFilterToMetric(scaleMetricValue(285000, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(278000, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="app_dau_mau"
          label="DAU/MAU Ratio"
          value={applyFilterToMetric(scaleMetricValue(15.9, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(15.6, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          target={20}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Active users chart */}
      <ChartCard
        title="Active Users Trend"
        subtitle="DAU / WAU / MAU over time"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={pActiveUsers as Record<string, string | number>[]}
          lines={[
            { key: "dau", color: "#3b82f6", label: "DAU" },
            { key: "wau", color: "#8b5cf6", label: "WAU" },
            { key: "mau", color: "#06b6d4", label: "MAU" },
          ]}
          height={300}
        />
        <ChartInsights insights={activeUsersInsights} />
      </ChartCard>

      {/* Two column charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Session Depth"
          subtitle="Avg screens per session & session duration"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardAreaChart
            data={pSessionMetrics as Record<string, string | number>[]}
            areas={[{ key: "avgScreens", color: "#8b5cf6", label: "Avg Screens/Session" }]}
            height={260}
          />
          <ChartInsights insights={sessionInsights} />
        </ChartCard>

        <ChartCard
          title="Error Rate Trend"
          subtitle="% of sessions encountering errors"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pErrorRate as Record<string, string | number>[]}
            lines={[{ key: "rate", color: "#ef4444", label: "Error Rate %" }]}
            valueType="percent"
            height={260}
          />
          <ChartInsights insights={errorInsights} />
        </ChartCard>
      </div>

      {/* Feature adoption */}
      <ChartCard
        title="Feature Adoption Rates"
        subtitle="% of MAU who used each feature in the period"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardBarChart
          data={featureAdoption}
          bars={[{ key: "rate", color: "#3b82f6", label: "Adoption %" }]}
          xAxisKey="feature"
          height={320}
        />
        <ChartInsights insights={featureInsights} />
      </ChartCard>

      {/* Top screens */}
      <ChartCard
        title="Top 10 Screens by View Count"
        subtitle="Screen views from refined_rudderstack.screens"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardBarChart
          data={apiTopScreens}
          bars={[{ key: "views", color: "#06b6d4", label: "Views" }]}
          xAxisKey="screen"
          height={360}
        />
      </ChartCard>

      <ActionItems section="App Health" items={actionItems} />
    </div>
  );
}
