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

interface SummaryRow {
  week_start: string;
  total_accounts: number;
  accounts_with_points: number;
  total_closing_pts: number;
  total_awarded: number;
  total_redeemed: number;
  total_expired: number;
  redemption_rate: number;
}

interface FlowRow {
  month: string;
  earned: number;
  redeemed: number;
  expired: number;
  net: number;
}

interface ClosingRow {
  month: string;
  total_points: number;
  total_members: number;
}

interface RedemptionRow {
  category: string;
  points: number;
  count: number;
}

export default function PointsProgramPage() {
  const { period } = usePeriod();
  const { apiParams } = useApiParams();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const { data: apiData } = useSWR(
    `/api/points-program?${apiParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const isLive = !!apiData?.summary?.length;

  // Summary data
  const summaryData = useMemo((): SummaryRow[] | null => {
    if (!apiData?.summary?.length) return null;
    return applyFilterToData(apiData.summary as SummaryRow[], filters);
  }, [apiData, filters]);

  // Flow trend
  const flowTrend = useMemo((): FlowRow[] | null => {
    if (!apiData?.flowTrend?.length) return null;
    return applyFilterToData(apiData.flowTrend as FlowRow[], filters);
  }, [apiData, filters]);

  // Closing balance trend
  const closingBalance = useMemo((): ClosingRow[] | null => {
    if (!apiData?.closingBalance?.length) return null;
    return applyFilterToData(apiData.closingBalance as ClosingRow[], filters);
  }, [apiData, filters]);

  // Redemption breakdown
  const redemptionBreakdown = useMemo((): RedemptionRow[] | null => {
    if (!apiData?.redemptionBreakdown?.length) return null;
    return applyFilterToData(apiData.redemptionBreakdown as RedemptionRow[], filters);
  }, [apiData, filters]);

  // KPI summary
  const kpiSummary = useMemo(() => {
    if (!summaryData?.length) return null;
    const latest = summaryData[summaryData.length - 1];
    const totalAwarded = summaryData.reduce((s, r) => s + r.total_awarded, 0);
    const totalRedeemed = summaryData.reduce((s, r) => s + r.total_redeemed, 0);
    const totalExpired = summaryData.reduce((s, r) => s + r.total_expired, 0);
    return {
      totalAccounts: latest.total_accounts,
      accountsWithPoints: latest.accounts_with_points,
      closingBalance: latest.total_closing_pts,
      redemptionRate: latest.redemption_rate,
      totalAwarded,
      totalRedeemed,
      totalExpired,
    };
  }, [summaryData]);

  const flowInsights = useMemo<ChartInsight[]>(() => [
    { text: `Points earned consistently exceeds redemptions across ${p.span}, driving growing liability on the balance sheet.`, type: "negative" },
    { text: "Redemption activity is healthy and growing, indicating customer engagement with the rewards program.", type: "positive" },
    { text: "Expired points spikes suggest batch expiry events — proactive customer notification could convert these to redemptions.", type: "neutral" },
    { text: "Net point accumulation trend should be cross-referenced with provisioning forecasts to ensure adequate reserves.", type: "hypothesis" },
  ], [p]);

  const closingInsights = useMemo<ChartInsight[]>(() => [
    { text: "Total outstanding points liability shows steady growth month-over-month.", type: "negative" },
    { text: "Active members with points are growing, suggesting the program drives ongoing engagement.", type: "positive" },
    { text: "Consider introducing time-limited bonus redemption campaigns to manage growing liability.", type: "neutral" },
  ], []);

  const redemptionInsights = useMemo<ChartInsight[]>(() => [
    { text: "Redemption category distribution reveals customer preferences for reward types.", type: "neutral" },
    { text: "Top redemption categories should inform catalog curation and partner negotiation priorities.", type: "positive" },
  ], []);

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
            metricKey="pts-total-accounts"
            label="Total Accounts"
            value={applyFilterToMetric(kpiSummary.totalAccounts, filters, false)}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="pts-with-points"
            label="Accounts with Points"
            value={applyFilterToMetric(kpiSummary.accountsWithPoints, filters, false)}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="pts-closing-balance"
            label="Closing Balance"
            value={applyFilterToMetric(kpiSummary.closingBalance, filters, false)}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="pts-redemption-rate"
            label="Redemption Rate"
            value={kpiSummary.redemptionRate}
            unit="percent"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
        </div>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Points KPIs require points_summary (DW010) table"
        />
      )}

      {/* Points flow trend */}
      {flowTrend ? (
        <ChartCard
          title="Monthly Points Flow"
          subtitle="Earned, redeemed, expired, and net change"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
          liveData={isLive}
        >
          <DashboardBarChart
            data={flowTrend.map((r) => ({
              month: r.month,
              earned: r.earned,
              redeemed: r.redeemed,
              expired: r.expired,
            }))}
            bars={[
              { key: "earned", color: "#22c55e", label: "Earned" },
              { key: "redeemed", color: "#6366f1", label: "Redeemed" },
              { key: "expired", color: "#ef4444", label: "Expired" },
            ]}
            xAxisKey="month"
            height={300}
          />
          <ChartInsights insights={flowInsights} />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Points flow requires points_summary (DW010)"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Closing balance trend */}
        {closingBalance ? (
          <ChartCard
            title="Outstanding Points Liability"
            subtitle="Total closing points balance by month"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
            liveData
          >
            <DashboardLineChart
              data={closingBalance.map((r) => ({
                date: r.month,
                points: r.total_points,
              }))}
              lines={[{ key: "points", color: "#f59e0b", label: "Total Points" }]}
              height={280}
            />
            <ChartInsights insights={closingInsights} />
          </ChartCard>
        ) : (
          <SampleDataBanner
            dataset="mart_finexus"
            reason="Points liability requires points_summary (DW010)"
          />
        )}

        {/* Redemption breakdown */}
        {redemptionBreakdown ? (
          <ChartCard
            title="Redemption by Category"
            subtitle="Points redeemed by transaction type"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
            liveData
          >
            <DashboardBarChart
              data={redemptionBreakdown.slice(0, 10).map((r) => ({
                category: r.category,
                points: r.points,
              }))}
              bars={[{ key: "points", color: "#8b5cf6", label: "Points Redeemed" }]}
              xAxisKey="category"
              height={280}
            />
            <ChartInsights insights={redemptionInsights} />
          </ChartCard>
        ) : (
          <SampleDataBanner
            dataset="mart_finexus"
            reason="Redemption breakdown requires points_details (DW011)"
          />
        )}
      </div>

      {/* Weekly summary trend */}
      {summaryData ? (
        <ChartCard
          title="Weekly Redemption Rate Trend"
          subtitle="% of awarded points redeemed per week"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
          liveData
        >
          <DashboardLineChart
            data={summaryData.map((r) => ({
              date: r.week_start,
              rate: r.redemption_rate,
            }))}
            lines={[{ key: "rate", color: "#22c55e", label: "Redemption Rate %" }]}
            valueType="percent"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Redemption rate trend requires points_summary (DW010)"
        />
      )}

      <ActionItems section="Points Program" items={actionItems} />
    </div>
  );
}
