"use client";

import { useMemo, useCallback } from "react";
import useSWR from "swr";
import { Header } from "@/components/layout/header";
import { useTranslations } from "next-intl";
import { ChartCard } from "@/components/dashboard/chart-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { ChartSkeleton, MetricCardsSkeleton } from "@/components/dashboard/chart-skeleton";
import { usePeriod } from "@/hooks/use-period";
import { useApiParams } from "@/hooks/use-api-params";
import { getPeriodRange } from "@/lib/period-data";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "2026-03-17";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

interface ChannelRow {
  utm_source: string;
  reached_decision: number;
  approved: number;
  approval_rate: number;
  dpd30_plus: number;
  approved_with_dpd_data: number;
  dpd30_rate: number;
}

export default function ChannelQualityPage() {
  const tNav = useTranslations("nav");
  const { period } = usePeriod();
  const { apiParams } = useApiParams();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData, isLoading } = useSWR(
    `/api/channel-quality?${apiParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const isLive = !!apiData?.channelQuality?.length;

  const channelData = useMemo((): ChannelRow[] | null => {
    if (!apiData?.channelQuality?.length) return null;
    return apiData.channelQuality as ChannelRow[];
  }, [apiData]);

  // KPI summary
  const kpiSummary = useMemo(() => {
    if (!channelData) return null;
    const totalDecisions = channelData.reduce((s, r) => s + r.reached_decision, 0);
    const totalApproved = channelData.reduce((s, r) => s + r.approved, 0);
    const overallApprovalRate = totalDecisions > 0 ? Math.round((totalApproved / totalDecisions) * 1000) / 10 : 0;
    const totalDpd = channelData.reduce((s, r) => s + r.dpd30_plus, 0);
    const totalWithDpd = channelData.reduce((s, r) => s + r.approved_with_dpd_data, 0);
    const overallDpdRate = totalWithDpd > 0 ? Math.round((totalDpd / totalWithDpd) * 10000) / 100 : 0;
    const channelCount = channelData.length;
    return { totalDecisions, totalApproved, overallApprovalRate, overallDpdRate, channelCount };
  }, [channelData]);

  const channelInsights = useMemo<ChartInsight[]>(() => [
    { text: "Organic channel typically delivers the highest approval rate and lowest delinquency, confirming organic users have strongest credit quality.", type: "positive" },
    { text: "Paid social channels show higher volume but elevated DPD rates — audience targeting refinement could improve quality.", type: "negative" },
    { text: "Referral channel shows strong approval rates with moderate volume — scaling this channel could improve portfolio quality mix.", type: "positive" },
    { text: "Channels with DPD 30+ rates above 6% should trigger automatic risk policy tightening to prevent portfolio deterioration.", type: "neutral" },
  ], []);

  const approvalInsights = useMemo<ChartInsight[]>(() => [
    { text: "Approval rate variance across channels exceeds 20pp, indicating channel source is a strong predictor of applicant quality.", type: "neutral" },
    { text: "Low-approval channels increase processing costs with no revenue. Consider pre-screening or minimum score thresholds per channel.", type: "negative" },
  ], []);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="flex flex-col">
      <Header title={tNav("channelQuality")} />

      <div className="flex-1 space-y-6 p-6">
        <ActiveFiltersBanner />

        {/* KPI row */}
        {kpiSummary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              metricKey="cq-total-decisions"
              label="Total Decisions"
              value={kpiSummary.totalDecisions}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData
            />
            <MetricCard
              metricKey="cq-total-approved"
              label="Total Approved"
              value={kpiSummary.totalApproved}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData
            />
            <MetricCard
              metricKey="cq-approval-rate"
              label="Overall Approval Rate"
              value={kpiSummary.overallApprovalRate}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData
            />
            <MetricCard
              metricKey="cq-dpd-rate"
              label="Overall DPD 30+ Rate"
              value={kpiSummary.overallDpdRate}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              higherIsBetter={false}
              target={6}
              liveData
            />
          </div>
        ) : isLoading ? (
          <MetricCardsSkeleton />
        ) : (
          <SampleDataBanner
            dataset="refined_rudderstack + mart_finexus"
            reason="Channel quality data requires decision_completed and financial_account_updates (DW004)"
          />
        )}

        {/* Channel volume chart */}
        {channelData ? (
          <ChartCard
            title="Channel Volume & Approval"
            subtitle="Applications reaching decision and approvals by UTM source"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
            liveData={isLive}
          >
            <DashboardBarChart
              data={channelData.map((r) => ({
                channel: r.utm_source,
                decisions: r.reached_decision,
                approved: r.approved,
              }))}
              bars={[
                { key: "decisions", color: "#6366f1", label: "Decisions" },
                { key: "approved", color: "#22c55e", label: "Approved" },
              ]}
              xAxisKey="channel"
              height={300}
            />
            <ChartInsights insights={channelInsights} />
          </ChartCard>
        ) : isLoading ? (
          <ChartSkeleton />
        ) : (
          <SampleDataBanner
            dataset="refined_rudderstack + mart_finexus"
            reason="Channel volume requires milestone_complete and decision_completed"
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Approval rate by channel */}
          {channelData ? (
            <ChartCard
              title="Approval Rate by Channel"
              subtitle="% approved by UTM source"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              onRefresh={handleRefresh}
              liveData
            >
              <DashboardBarChart
                data={channelData.map((r) => ({
                  channel: r.utm_source,
                  rate: r.approval_rate,
                }))}
                bars={[{ key: "rate", color: "#22c55e", label: "Approval Rate %" }]}
                xAxisKey="channel"
                height={280}
              />
              <ChartInsights insights={approvalInsights} />
            </ChartCard>
          ) : isLoading ? (
            <ChartSkeleton />
          ) : (
            <SampleDataBanner
              dataset="refined_rudderstack"
              reason="Approval rate by channel requires decision data"
            />
          )}

          {/* DPD 30+ rate by channel */}
          {channelData ? (
            <ChartCard
              title="DPD 30+ Rate by Channel"
              subtitle="Delinquency rate by UTM source"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              onRefresh={handleRefresh}
              liveData
            >
              <DashboardBarChart
                data={channelData.map((r) => ({
                  channel: r.utm_source,
                  rate: r.dpd30_rate,
                }))}
                bars={[{ key: "rate", color: "#ef4444", label: "DPD 30+ Rate %" }]}
                xAxisKey="channel"
                height={280}
              />
            </ChartCard>
          ) : isLoading ? (
            <ChartSkeleton />
          ) : (
            <SampleDataBanner
              dataset="mart_finexus"
              reason="DPD rate by channel requires financial_account_updates (DW004)"
            />
          )}
        </div>

        <ActionItems section="Channel Quality" items={actionItems} />
      </div>
    </div>
  );
}
