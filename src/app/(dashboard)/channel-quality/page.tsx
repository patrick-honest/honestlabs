"use client";

import { useMemo } from "react";
import { Header } from "@/components/layout/header";
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
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

// ==========================================================================
// Mock Data — Acquisition Channel Quality
// ==========================================================================

const AS_OF = "2026-03-17";

interface ChannelRow {
  channel: string;
  applications: number;
  share_pct: number;
  approval_rate: number;
  dpd_30_rate: number;
}

const channelData: ChannelRow[] = [
  { channel: "organic", applications: 5625, share_pct: 45, approval_rate: 65, dpd_30_rate: 4.2 },
  { channel: "google_ads", applications: 2500, share_pct: 20, approval_rate: 58, dpd_30_rate: 5.8 },
  { channel: "meta", applications: 1875, share_pct: 15, approval_rate: 52, dpd_30_rate: 7.1 },
  { channel: "tiktok", applications: 1250, share_pct: 10, approval_rate: 48, dpd_30_rate: 8.5 },
  { channel: "referral", applications: 625, share_pct: 5, approval_rate: 72, dpd_30_rate: 3.1 },
  { channel: "other", applications: 625, share_pct: 5, approval_rate: 55, dpd_30_rate: 6.0 },
];

// Volume bar data
const baseVolumeData = channelData.map((c) => ({
  channel: c.channel,
  applications: c.applications,
}));

// Approval rate bar data
const approvalRateData = channelData.map((c) => ({
  channel: c.channel,
  approval_rate: c.approval_rate,
}));

// Delinquency rate bar data
const delinquencyData = channelData.map((c) => ({
  channel: c.channel,
  dpd_30_rate: c.dpd_30_rate,
}));

// Quality score: composite of approval rate and inverse delinquency
// Score = (approval_rate * 0.6) + ((100 - dpd_30_rate * 10) * 0.4), capped at 100
function computeQualityScore(approvalRate: number, dpdRate: number): number {
  const score = approvalRate * 0.6 + (100 - dpdRate * 10) * 0.4;
  return Math.min(100, Math.max(0, Math.round(score * 100) / 100));
}

// Monthly quality trend per channel
const baseQualityTrend = [
  {
    date: "Oct",
    organic: computeQualityScore(63, 4.5),
    google_ads: computeQualityScore(56, 6.2),
    meta: computeQualityScore(50, 7.5),
    tiktok: computeQualityScore(45, 9.0),
    referral: computeQualityScore(70, 3.5),
  },
  {
    date: "Nov",
    organic: computeQualityScore(64, 4.4),
    google_ads: computeQualityScore(57, 6.0),
    meta: computeQualityScore(51, 7.3),
    tiktok: computeQualityScore(46, 8.8),
    referral: computeQualityScore(71, 3.3),
  },
  {
    date: "Dec",
    organic: computeQualityScore(64, 4.3),
    google_ads: computeQualityScore(57, 5.9),
    meta: computeQualityScore(51, 7.2),
    tiktok: computeQualityScore(47, 8.6),
    referral: computeQualityScore(71, 3.2),
  },
  {
    date: "Jan",
    organic: computeQualityScore(65, 4.3),
    google_ads: computeQualityScore(58, 5.9),
    meta: computeQualityScore(52, 7.2),
    tiktok: computeQualityScore(47, 8.6),
    referral: computeQualityScore(72, 3.2),
  },
  {
    date: "Feb",
    organic: computeQualityScore(65, 4.2),
    google_ads: computeQualityScore(58, 5.8),
    meta: computeQualityScore(52, 7.1),
    tiktok: computeQualityScore(48, 8.5),
    referral: computeQualityScore(72, 3.1),
  },
  {
    date: "Mar",
    organic: computeQualityScore(65, 4.2),
    google_ads: computeQualityScore(58, 5.8),
    meta: computeQualityScore(52, 7.1),
    tiktok: computeQualityScore(48, 8.5),
    referral: computeQualityScore(72, 3.1),
  },
];

// ==========================================================================
// Action items
// ==========================================================================

const actionItems: ActionItem[] = [
  {
    id: "cq-1",
    priority: "urgent",
    action: "Investigate TikTok channel delinquency — 8.5% DPD 30+ rate.",
    detail: "Nearly 2x organic. Review audience targeting and risk policy for this cohort.",
  },
  {
    id: "cq-2",
    priority: "positive",
    action: "Scale referral channel — best quality score.",
    detail: "72% approval, 3.1% DPD but only 5% of volume. Evaluate incentive increase.",
  },
  {
    id: "cq-3",
    priority: "monitor",
    action: "Add UTM medium/campaign breakdowns.",
    detail: "Current view is source-level only. Campaign-level data would enable spend optimization.",
  },
  {
    id: "cq-4",
    priority: "urgent",
    action: "Set up Meta channel risk guardrails — 7.1% DPD rate.",
    detail: "Exceeds 6% threshold. Consider tighter pre-qualification or reduced bid caps.",
  },
];

// ==========================================================================
// Page
// ==========================================================================

export default function ChannelQualityPage() {
  const { period } = usePeriod();
  const { isDark } = useTheme();
  const { filters } = useFilters();
  const range = getPeriodRange(period);
  const { changeAbbrev } = getPeriodInsightLabels(period);

  // KPI values
  const totalApplications = useMemo(() => {
    const base = channelData.reduce((sum, c) => sum + c.applications, 0);
    return Math.round(applyFilterToMetric(scaleMetricValue(base, period, false), filters, false));
  }, [period, filters]);

  const overallApprovalRate = useMemo(() => {
    const totalApps = channelData.reduce((sum, c) => sum + c.applications, 0);
    const weightedApproval = channelData.reduce((sum, c) => sum + c.approval_rate * c.applications, 0);
    return Math.round((weightedApproval / totalApps) * 100) / 100;
  }, []);

  const bestChannel = useMemo(() => {
    const best = [...channelData].sort(
      (a, b) => computeQualityScore(b.approval_rate, b.dpd_30_rate) - computeQualityScore(a.approval_rate, a.dpd_30_rate),
    )[0];
    return best.channel;
  }, []);

  const worstByDelinquency = useMemo(() => {
    const worst = [...channelData].sort((a, b) => b.dpd_30_rate - a.dpd_30_rate)[0];
    return `${worst.channel} (${worst.dpd_30_rate}%)`;
  }, []);

  // Chart data
  const volumeChartData = useMemo(() => {
    const scaled = baseVolumeData.map((d) => ({
      ...d,
      applications: Math.round(scaleMetricValue(d.applications, period, false)),
    }));
    return applyFilterToData(scaled, filters);
  }, [period, filters]);

  const qualityTrend = useMemo(
    () => applyFilterToData(scaleTrendData(baseQualityTrend, period, "date"), filters),
    [period, filters],
  );

  // Insights
  const volumeInsights: ChartInsight[] = [
    { text: "Organic drives 45% of total applications — the largest and most cost-efficient channel.", type: "positive" },
    { text: `Google Ads and Meta together account for 35% of volume, up from 30% last ${changeAbbrev.toLowerCase()}.`, type: "neutral" },
    { text: "TikTok channel growing rapidly (10% share) but brings the highest risk cohort.", type: "negative" },
  ];

  const approvalInsights: ChartInsight[] = [
    { text: "Referral channel has the highest approval rate at 72% — strong self-selection effect.", type: "positive" },
    { text: "TikTok approval rate at 48% is 17pp below organic, suggesting looser audience targeting.", type: "negative" },
    { text: "Overall approval rate of ~60% is in line with Indonesian digital credit card benchmarks.", type: "neutral" },
  ];

  const delinquencyInsights: ChartInsight[] = [
    { text: "Referral channel has the lowest DPD 30+ rate at 3.1% — referrers pre-qualify applicants.", type: "positive" },
    { text: "TikTok DPD 30+ at 8.5% is 2x the organic rate — cohort risk may outweigh acquisition cost savings.", type: "negative" },
    { text: "Meta delinquency at 7.1% warrants tighter risk controls or bid adjustments.", type: "negative" },
    { text: "OJK guidelines on responsible lending could increase regulatory scrutiny on high-DPD channels.", type: "hypothesis" },
  ];

  const qualityInsights: ChartInsight[] = [
    { text: "Referral consistently leads the quality score, followed closely by organic.", type: "positive" },
    { text: "TikTok quality score is improving month-over-month as targeting refines, but still lags.", type: "neutral" },
    { text: "Quality score = 60% approval weight + 40% inverse delinquency weight.", type: "neutral" },
  ];

  return (
    <div className="flex flex-col">
      <Header title="Acquisition Channel Quality" />

      <div className="flex-1 space-y-6 p-6">
        <ActiveFiltersBanner />

        <SampleDataBanner
          dataset="refined_rudderstack + mart_finexus"
          reason="Channel quality uses sample mock — connect BigQuery for live results"
        />

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            metricKey="total_applications"
            label="Total Applications"
            value={totalApplications}
            prevValue={Math.round(totalApplications * 0.94)}
            unit="count"
            asOf={AS_OF}
            dataRange={range}
            higherIsBetter={true}
          />
          <MetricCard
            metricKey="overall_approval_rate"
            label="Overall Approval Rate"
            value={overallApprovalRate}
            prevValue={overallApprovalRate - 1.2}
            unit="percent"
            asOf={AS_OF}
            dataRange={range}
            higherIsBetter={true}
          />
          <MetricCard
            metricKey="best_channel"
            label="Best Channel by Quality"
            value={computeQualityScore(
              channelData.find((c) => c.channel === bestChannel)!.approval_rate,
              channelData.find((c) => c.channel === bestChannel)!.dpd_30_rate,
            )}
            prevValue={computeQualityScore(70, 3.5)}
            unit="count"
            asOf={AS_OF}
            dataRange={range}
            higherIsBetter={true}
          />
          <MetricCard
            metricKey="worst_delinquency"
            label="Worst DPD 30+ Rate"
            value={channelData.sort((a, b) => b.dpd_30_rate - a.dpd_30_rate)[0].dpd_30_rate}
            prevValue={9.0}
            unit="percent"
            asOf={AS_OF}
            dataRange={range}
            higherIsBetter={false}
          />
        </div>

        {/* Channel detail table */}
        <div className={cn(
          "rounded-xl border p-5",
          isDark
            ? "border-[var(--border)] bg-[var(--surface)]"
            : "border-[var(--border)] bg-[var(--surface)] shadow-sm"
        )}>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Channel Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="pb-2 text-left font-medium text-[var(--text-secondary)]">Channel</th>
                  <th className="pb-2 text-right font-medium text-[var(--text-secondary)]">Applications</th>
                  <th className="pb-2 text-right font-medium text-[var(--text-secondary)]">Share</th>
                  <th className="pb-2 text-right font-medium text-[var(--text-secondary)]">Approval %</th>
                  <th className="pb-2 text-right font-medium text-[var(--text-secondary)]">DPD 30+ %</th>
                  <th className="pb-2 text-right font-medium text-[var(--text-secondary)]">Quality Score</th>
                </tr>
              </thead>
              <tbody>
                {channelData.map((c) => {
                  const score = computeQualityScore(c.approval_rate, c.dpd_30_rate);
                  const scoreColor = score >= 55
                    ? isDark ? "text-[#06D6A0]" : "text-[#059669]"
                    : score >= 40
                      ? "text-[var(--text-primary)]"
                      : isDark ? "text-[#FF6B6B]" : "text-[#DC2626]";
                  return (
                    <tr key={c.channel} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2.5 font-medium text-[var(--text-primary)]">{c.channel}</td>
                      <td className="py-2.5 text-right text-[var(--text-primary)]">{c.applications.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-[var(--text-muted)]">{c.share_pct}%</td>
                      <td className="py-2.5 text-right text-[var(--text-primary)]">{c.approval_rate}%</td>
                      <td className="py-2.5 text-right text-[var(--text-primary)]">{c.dpd_30_rate}%</td>
                      <td className={cn("py-2.5 text-right font-semibold", scoreColor)}>{score.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts Row 1: Volume + Approval */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Application Volume by Channel"
            subtitle="Distinct applicants per UTM source"
            asOf={AS_OF}
            dataRange={range}
          >
            <DashboardBarChart
              data={volumeChartData}
              bars={[{ key: "applications", color: isDark ? "#5B22FF" : "#D00083", label: "Applications" }]}
              xAxisKey="channel"
              height={260}
            />
            <ChartInsights insights={volumeInsights} />
          </ChartCard>

          <ChartCard
            title="Approval Rate by Channel"
            subtitle="% of applicants approved per source"
            asOf={AS_OF}
            dataRange={range}
          >
            <DashboardBarChart
              data={approvalRateData}
              bars={[{ key: "approval_rate", color: isDark ? "#06D6A0" : "#059669", label: "Approval %" }]}
              xAxisKey="channel"
              height={260}
            />
            <ChartInsights insights={approvalInsights} />
          </ChartCard>
        </div>

        {/* Charts Row 2: Delinquency + Quality Trend */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="DPD 30+ Rate by Channel"
            subtitle="Delinquency rate of approved cohort"
            asOf={AS_OF}
            dataRange={range}
          >
            <DashboardBarChart
              data={delinquencyData}
              bars={[{ key: "dpd_30_rate", color: isDark ? "#FF6B6B" : "#DC2626", label: "DPD 30+ %" }]}
              xAxisKey="channel"
              height={260}
            />
            <ChartInsights insights={delinquencyInsights} />
          </ChartCard>

          <ChartCard
            title="Channel Quality Score Trend"
            subtitle="Composite score (60% approval + 40% inverse DPD)"
            asOf={AS_OF}
            dataRange={range}
          >
            <DashboardLineChart
              data={qualityTrend}
              lines={[
                { key: "organic", color: isDark ? "#5B22FF" : "#D00083", label: "Organic" },
                { key: "google_ads", color: isDark ? "#7C4DFF" : "#9333EA", label: "Google Ads" },
                { key: "meta", color: isDark ? "#06D6A0" : "#059669", label: "Meta" },
                { key: "tiktok", color: isDark ? "#FFD166" : "#F5A623", label: "TikTok" },
                { key: "referral", color: isDark ? "#FF6B6B" : "#DC2626", label: "Referral" },
              ]}
              height={260}
            />
            <ChartInsights insights={qualityInsights} />
          </ChartCard>
        </div>

        {/* Action Items */}
        <ActionItems section="Channel Quality" items={actionItems} />
      </div>
    </div>
  );
}
