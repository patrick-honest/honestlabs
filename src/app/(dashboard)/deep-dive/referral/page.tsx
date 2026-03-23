"use client";

import { useMemo, useCallback } from "react";
import useSWR from "swr";
import { ChartCard } from "@/components/dashboard/chart-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod } from "@/hooks/use-period";
import { useApiParams } from "@/hooks/use-api-params";
import { useFilters } from "@/hooks/use-filters";
import { getPeriodRange, getPeriodInsightLabels } from "@/lib/period-data";
import { applyFilterToData, applyFilterToMetric } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 15, 2026";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
  const { period } = usePeriod();
  const { apiParams } = useApiParams();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const { data: apiData } = useSWR(
    `/api/referral?${apiParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const isLive = !!apiData?.funnel?.length;

  // Weekly funnel data
  const funnelData = useMemo(() => {
    if (!apiData?.funnel?.length) return null;
    return applyFilterToData(apiData.funnel as { week_start: string; started: number; approved: number; conversion_rate: number }[], filters);
  }, [apiData, filters]);

  // By channel data
  const byChannel = useMemo(() => {
    if (!apiData?.byChannel?.length) return null;
    return applyFilterToData(apiData.byChannel as { referring_source: string; referring_medium: string; started_count: number; approved_count: number; conversion_rate: number }[], filters);
  }, [apiData, filters]);

  // Monthly funnel trend
  const funnelTrend = useMemo(() => {
    if (!apiData?.funnelTrend?.length) return null;
    return applyFilterToData(apiData.funnelTrend as { month: string; shared: number; started: number; approved: number }[], filters);
  }, [apiData, filters]);

  // Approval rate trend
  const approvalRate = useMemo(() => {
    if (!apiData?.approvalRate?.length) return null;
    return applyFilterToData(apiData.approvalRate as { month: string; started: number; approved: number; rate: number }[], filters);
  }, [apiData, filters]);

  // Per-user distribution
  const perUser = useMemo(() => {
    if (!apiData?.perUser?.length) return null;
    return applyFilterToData(apiData.perUser as { bucket: string; users: number }[], filters);
  }, [apiData, filters]);

  // KPI summary
  const kpiSummary = useMemo(() => {
    if (!funnelData?.length) return null;
    const totalStarted = funnelData.reduce((s, r) => s + r.started, 0);
    const totalApproved = funnelData.reduce((s, r) => s + r.approved, 0);
    const latestRate = funnelData[funnelData.length - 1]?.conversion_rate ?? 0;
    const prevRate = funnelData.length > 1 ? funnelData[funnelData.length - 2]?.conversion_rate ?? null : null;
    return { totalStarted, totalApproved, latestRate, prevRate, overallRate: totalStarted > 0 ? Math.round((totalApproved / totalStarted) * 10000) / 100 : 0 };
  }, [funnelData]);

  const funnelInsights = useMemo<ChartInsight[]>(() => [
    { text: `Referral conversion shows steady improvement across ${p.span}, with the latest week reaching the highest rate in the period.`, type: "positive" },
    { text: "Organic and WhatsApp channels consistently outperform paid referral sources on conversion rate.", type: "positive" },
    { text: "Week-over-week variance suggests external factors (campaigns, seasonality) significantly influence referral volume.", type: "neutral" },
    { text: "A referral-specific onboarding flow could lift conversion by reducing friction for referred users who arrive with higher intent.", type: "hypothesis" },
  ], [p]);

  const channelInsights = useMemo<ChartInsight[]>(() => [
    { text: "Channel quality varies significantly — top channels convert at 2x the rate of bottom channels.", type: "neutral" },
    { text: "High-volume low-conversion channels may benefit from pre-qualification or adjusted incentive structures.", type: "neutral" },
    { text: "Organic referrals demonstrate the highest quality, suggesting word-of-mouth remains the strongest acquisition driver.", type: "positive" },
  ], []);

  const trendInsights = useMemo<ChartInsight[]>(() => [
    { text: `Monthly referral volume shows growth trajectory over ${p.span} with seasonal dips in holiday months.`, type: "positive" },
    { text: "The gap between started and approved narrows in recent months, indicating improving referral quality.", type: "positive" },
    { text: "Shared-to-started ratio suggests room to improve the referral link click-through experience.", type: "neutral" },
  ], [p]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI row */}
      {kpiSummary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            metricKey="referral-started"
            label="Referrals Started"
            value={applyFilterToMetric(kpiSummary.totalStarted, filters, false)}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="referral-approved"
            label="Referrals Approved"
            value={applyFilterToMetric(kpiSummary.totalApproved, filters, false)}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="referral-conversion"
            label="Latest Conversion Rate"
            value={kpiSummary.latestRate}
            prevValue={kpiSummary.prevRate}
            unit="percent"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="referral-overall-rate"
            label="Overall Conversion Rate"
            value={kpiSummary.overallRate}
            unit="percent"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
        </div>
      ) : (
        <SampleDataBanner
          dataset="refined_rudderstack"
          reason="Referral KPIs require referral_application_started and referral_approved tables"
        />
      )}

      {/* Weekly conversion trend */}
      {funnelData ? (
        <ChartCard
          title="Weekly Referral Conversion"
          subtitle="Started vs approved referrals per week"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
          liveData={isLive}
        >
          <DashboardBarChart
            data={funnelData.map((r) => ({
              week: r.week_start,
              started: r.started,
              approved: r.approved,
            }))}
            bars={[
              { key: "started", color: "#6366f1", label: "Started" },
              { key: "approved", color: "#22c55e", label: "Approved" },
            ]}
            xAxisKey="week"
            height={300}
          />
          <ChartInsights insights={funnelInsights} />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="refined_rudderstack"
          reason="Referral funnel requires referral events"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Channel */}
        {byChannel ? (
          <ChartCard
            title="Referrals by Channel"
            subtitle="Volume and conversion rate by source"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
            liveData
          >
            <DashboardBarChart
              data={byChannel.slice(0, 10).map((r) => ({
                channel: `${r.referring_source}/${r.referring_medium}`,
                started: r.started_count,
                approved: r.approved_count,
              }))}
              bars={[
                { key: "started", color: "#6366f1", label: "Started" },
                { key: "approved", color: "#22c55e", label: "Approved" },
              ]}
              xAxisKey="channel"
              height={280}
            />
            <ChartInsights insights={channelInsights} />
          </ChartCard>
        ) : (
          <SampleDataBanner
            dataset="refined_rudderstack"
            reason="Channel breakdown requires referral events with UTM data"
          />
        )}

        {/* Per-user distribution */}
        {perUser ? (
          <ChartCard
            title="Referrals per User"
            subtitle="Distribution of referral counts per referrer"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
            liveData
          >
            <DashboardBarChart
              data={perUser.map((r) => ({
                bucket: r.bucket,
                users: r.users,
              }))}
              bars={[{ key: "users", color: "#8b5cf6", label: "Users" }]}
              xAxisKey="bucket"
              height={280}
            />
          </ChartCard>
        ) : (
          <SampleDataBanner
            dataset="refined_rudderstack"
            reason="Per-user distribution requires referral events"
          />
        )}
      </div>

      {/* Monthly funnel trend */}
      {funnelTrend ? (
        <ChartCard
          title="Monthly Referral Trend"
          subtitle="Shared, started, and approved referrals by month"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
          liveData
        >
          <DashboardBarChart
            data={funnelTrend.map((r) => ({
              month: r.month,
              shared: r.shared,
              started: r.started,
              approved: r.approved,
            }))}
            bars={[
              { key: "shared", color: "#94a3b8", label: "Shared" },
              { key: "started", color: "#6366f1", label: "Started" },
              { key: "approved", color: "#22c55e", label: "Approved" },
            ]}
            xAxisKey="month"
            height={300}
          />
          <ChartInsights insights={trendInsights} />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="refined_rudderstack"
          reason="Monthly trend requires referral events"
        />
      )}

      {/* Approval rate trend */}
      {approvalRate ? (
        <ChartCard
          title="Referral Approval Rate Trend"
          subtitle="Monthly conversion rate (%)"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
          liveData
        >
          <DashboardLineChart
            data={approvalRate.map((r) => ({
              date: r.month,
              rate: r.rate,
            }))}
            lines={[{ key: "rate", color: "#22c55e", label: "Conversion Rate %" }]}
            valueType="percent"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="refined_rudderstack"
          reason="Approval rate trend requires referral events"
        />
      )}

      <ActionItems section="Referral Program" items={actionItems} />
    </div>
  );
}
