"use client";

import { useCallback, useMemo } from "react";
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

interface TrendRow {
  week_start: string;
  cli_count: number;
  avg_credit_line_change: number;
  unique_users: number;
}

interface ByTypeRow {
  credit_line_update_type: string;
  cli_count: number;
  avg_credit_line_change: number;
  unique_users: number;
}

interface VolumeTrendRow {
  month: string;
  cli_count: number;
  total_increase_idr: number;
}

export default function CreditLinePage() {
  const { period } = usePeriod();
  const { apiParams } = useApiParams();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const { data: apiData } = useSWR(
    `/api/credit-line?${apiParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const isLive = !!apiData?.trend?.length;

  // Weekly trend
  const trendData = useMemo((): TrendRow[] | null => {
    if (!apiData?.trend?.length) return null;
    return applyFilterToData(apiData.trend as TrendRow[], filters);
  }, [apiData, filters]);

  // By type
  const byTypeData = useMemo((): ByTypeRow[] | null => {
    if (!apiData?.byType?.length) return null;
    return applyFilterToData(apiData.byType as ByTypeRow[], filters);
  }, [apiData, filters]);

  // Volume trend
  const volumeTrend = useMemo((): VolumeTrendRow[] | null => {
    if (!apiData?.volumeTrend?.length) return null;
    return applyFilterToData(apiData.volumeTrend as VolumeTrendRow[], filters);
  }, [apiData, filters]);

  // KPI summary
  const kpiSummary = useMemo(() => {
    if (!trendData?.length) return null;
    const totalCli = trendData.reduce((s, r) => s + r.cli_count, 0);
    const totalUsers = trendData.reduce((s, r) => s + r.unique_users, 0);
    const allChanges = trendData.reduce((s, r) => s + r.avg_credit_line_change * r.cli_count, 0);
    const avgChange = totalCli > 0 ? Math.round(allChanges / totalCli) : 0;
    const latest = trendData[trendData.length - 1];
    const prev = trendData.length > 1 ? trendData[trendData.length - 2] : null;
    return {
      totalCli,
      totalUsers,
      avgChange,
      latestWeekCount: latest.cli_count,
      prevWeekCount: prev?.cli_count ?? null,
    };
  }, [trendData]);

  const trendInsights = useMemo<ChartInsight[]>(() => [
    { text: `CLI activity shows consistent volume across ${p.span}, indicating a mature and steady credit line management program.`, type: "positive" },
    { text: "Unique users receiving CLIs each week suggests good distribution across the portfolio rather than concentration.", type: "positive" },
    { text: "Average credit line change should be monitored alongside delinquency rates for recently-increased accounts.", type: "neutral" },
    { text: "Seasonal patterns in CLI volume may correlate with spending seasons — pre-Ramadan and year-end increases could drive utilization.", type: "hypothesis" },
  ], [p]);

  const byTypeInsights = useMemo<ChartInsight[]>(() => [
    { text: "Automatic CLIs dominate volume, reflecting strong system-driven credit management capability.", type: "positive" },
    { text: "Manual CLIs show higher average increases, suggesting they target higher-value or exceptional cases.", type: "neutral" },
    { text: "Promotional CLIs should be tracked for ROI — measure incremental spend and revenue vs. increased exposure.", type: "negative" },
  ], []);

  const volumeInsights = useMemo<ChartInsight[]>(() => [
    { text: "Monthly total IDR increase shows the aggregate exposure growth from credit line increases.", type: "neutral" },
    { text: "Month-over-month CLI volume trends help forecast future credit limit inventory requirements.", type: "neutral" },
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
            metricKey="cli-total"
            label="Total CLIs"
            value={applyFilterToMetric(kpiSummary.totalCli, filters, false)}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="cli-users"
            label="Unique Recipients"
            value={applyFilterToMetric(kpiSummary.totalUsers, filters, false)}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="cli-avg-change"
            label="Avg CLI Amount"
            value={applyFilterToMetric(kpiSummary.avgChange, filters, false)}
            unit="idr"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="cli-latest-week"
            label="Latest Week CLIs"
            value={applyFilterToMetric(kpiSummary.latestWeekCount, filters, false)}
            prevValue={kpiSummary.prevWeekCount != null ? applyFilterToMetric(kpiSummary.prevWeekCount, filters, false) : null}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
        </div>
      ) : (
        <SampleDataBanner
          dataset="refined_rudderstack"
          reason="Credit line KPIs require credit_line_increased events"
        />
      )}

      {/* Weekly CLI trend */}
      {trendData ? (
        <ChartCard
          title="Weekly CLI Activity"
          subtitle="Credit line increases and unique recipients per week"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
          liveData={isLive}
        >
          <DashboardBarChart
            data={trendData.map((r) => ({
              week: r.week_start,
              clis: r.cli_count,
              users: r.unique_users,
            }))}
            bars={[
              { key: "clis", color: "#6366f1", label: "CLIs" },
              { key: "users", color: "#22c55e", label: "Unique Users" },
            ]}
            xAxisKey="week"
            height={300}
          />
          <ChartInsights insights={trendInsights} />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="refined_rudderstack"
          reason="CLI trend requires credit_line_increased events"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By type */}
        {byTypeData ? (
          <ChartCard
            title="CLIs by Type"
            subtitle="Volume and average increase by update type"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
            liveData
          >
            <DashboardBarChart
              data={byTypeData.map((r) => ({
                type: r.credit_line_update_type,
                count: r.cli_count,
                users: r.unique_users,
              }))}
              bars={[
                { key: "count", color: "#6366f1", label: "CLI Count" },
                { key: "users", color: "#22c55e", label: "Unique Users" },
              ]}
              xAxisKey="type"
              height={280}
            />
            <ChartInsights insights={byTypeInsights} />
          </ChartCard>
        ) : (
          <SampleDataBanner
            dataset="refined_rudderstack"
            reason="CLI type breakdown requires credit_line_increased events"
          />
        )}

        {/* Monthly volume trend */}
        {volumeTrend ? (
          <ChartCard
            title="Monthly CLI Volume"
            subtitle="Total CLIs and IDR increase by month"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
            liveData
          >
            <DashboardBarChart
              data={volumeTrend.map((r) => ({
                month: r.month,
                count: r.cli_count,
              }))}
              bars={[{ key: "count", color: "#8b5cf6", label: "CLI Count" }]}
              xAxisKey="month"
              height={280}
            />
            <ChartInsights insights={volumeInsights} />
          </ChartCard>
        ) : (
          <SampleDataBanner
            dataset="refined_rudderstack"
            reason="Monthly volume requires credit_line_increased events"
          />
        )}
      </div>

      <ActionItems section="Credit Line Increases" items={actionItems} />
    </div>
  );
}
