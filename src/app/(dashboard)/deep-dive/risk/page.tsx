"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange } from "@/lib/period-data";

const AS_OF = "Mar 15, 2026";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const actionItems: ActionItem[] = [
  {
    id: "risk-1",
    priority: "positive",
    action: "30+ DPD rate declining to 4.7%.",
    detail: "Down from 5.2% peak in Dec. Collections effectiveness improving with cure rate at 62.9%.",
  },
  {
    id: "risk-2",
    priority: "urgent",
    action: "90+ DPD accounts still growing at 0.7%.",
    detail: "Flow rate from 61-90 to 90+ needs attention. Consider accelerated recovery strategies for this bucket.",
  },
  {
    id: "risk-3",
    priority: "monitor",
    action: "Write-off amounts plateauing near Rp 1B/month.",
    detail: "Monitor vintage performance to identify if specific cohorts are driving losses disproportionately.",
  },
];

export default function RiskPage() {
  const { period } = usePeriod();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const { dateParams } = useDateParams();

  const { data: apiData } = useSWR(
    `/api/risk?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  // ---------------------------------------------------------------------------
  // Transform DPD trend data
  // ---------------------------------------------------------------------------
  const dpdTrend = useMemo(() => {
    if (!apiData?.dpdTrend?.length) return null;
    return (apiData.dpdTrend as {
      week_start: string;
      current_count: number;
      dpd_1_30: number;
      dpd_31_60: number;
      dpd_61_90: number;
      dpd_90_plus: number;
      total_accounts: number;
      delinquency_rate_30plus: number;
    }[]).map((r) => ({
      date: r.week_start.replace("2025-", "").replace("2026-", "").slice(0, 5),
      current: r.current_count,
      dpd_1_30: r.dpd_1_30,
      dpd_31_60: r.dpd_31_60,
      dpd_61_90: r.dpd_61_90,
      dpd_90_plus: r.dpd_90_plus,
      total_accounts: r.total_accounts,
      delinquency_rate: r.delinquency_rate_30plus,
    }));
  }, [apiData]);

  // ---------------------------------------------------------------------------
  // Transform balance exposure data
  // ---------------------------------------------------------------------------
  const balanceExposure = useMemo(() => {
    if (!apiData?.balanceExposure?.length) return null;
    return (apiData.balanceExposure as {
      bucket: string;
      accounts: number;
      total_balance_idr: number;
    }[]).map((r) => ({
      bucket: r.bucket,
      accounts: r.accounts,
      balance: r.total_balance_idr,
    }));
  }, [apiData]);

  // ---------------------------------------------------------------------------
  // KPI values from latest week
  // ---------------------------------------------------------------------------
  const latestWeek = dpdTrend?.[dpdTrend.length - 1] ?? null;
  const prevWeek = dpdTrend && dpdTrend.length >= 2 ? dpdTrend[dpdTrend.length - 2] : null;

  const trendIsLive = !!dpdTrend?.length;
  const exposureIsLive = !!balanceExposure?.length;

  // Total exposure from balance data
  const totalExposure = balanceExposure
    ? balanceExposure.reduce((sum, r) => sum + r.balance, 0)
    : null;
  const prevTotalExposure = null; // No previous period comparison for exposure snapshot

  // Current % from latest week
  const currentPct = latestWeek
    ? Math.round((latestWeek.current / Math.max(latestWeek.total_accounts, 1)) * 10000) / 100
    : null;
  const prevCurrentPct = prevWeek
    ? Math.round((prevWeek.current / Math.max(prevWeek.total_accounts, 1)) * 10000) / 100
    : null;

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI Row + Charts — live data or fallback */}
      {dpdTrend && latestWeek ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              metricKey="risk_total_accounts"
              label="Total Accounts"
              value={latestWeek.total_accounts}
              prevValue={prevWeek?.total_accounts ?? null}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            />
            <MetricCard
              metricKey="risk_dpd_30plus_rate"
              label="30+ DPD Rate"
              value={latestWeek.delinquency_rate}
              prevValue={prevWeek?.delinquency_rate ?? null}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              higherIsBetter={false}
              liveData={trendIsLive}
            />
            <MetricCard
              metricKey="risk_current_pct"
              label="Current %"
              value={currentPct!}
              prevValue={prevCurrentPct}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            />
            <MetricCard
              metricKey="risk_total_exposure"
              label="Total Exposure (IDR)"
              value={totalExposure ?? 0}
              prevValue={prevTotalExposure}
              unit="idr"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={exposureIsLive}
            />
          </div>

          {/* DPD Distribution Trend — stacked bar */}
          <ChartCard
            title="DPD Distribution Trend"
            subtitle="Account counts by days-past-due bucket, weekly snapshot (Sunday)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={trendIsLive}
          >
            <DashboardBarChart
              data={dpdTrend}
              bars={[
                { key: "current", color: "#22c55e", label: "Current" },
                { key: "dpd_1_30", color: "#eab308", label: "1-30 DPD" },
                { key: "dpd_31_60", color: "#f97316", label: "31-60 DPD" },
                { key: "dpd_61_90", color: "#ef4444", label: "61-90 DPD" },
                { key: "dpd_90_plus", color: "#991b1b", label: "90+ DPD" },
              ]}
              xAxisKey="date"
              height={320}
              stacked
            />
          </ChartCard>

          {/* Delinquency Rate (30+ DPD) — line chart */}
          <ChartCard
            title="Delinquency Rate (30+ DPD)"
            subtitle="Percentage of accounts more than 30 days past due, by week"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={trendIsLive}
          >
            <DashboardLineChart
              data={dpdTrend}
              lines={[{ key: "delinquency_rate", color: "#ef4444", label: "30+ DPD Rate %" }]}
              xAxisKey="date"
              valueType="percent"
              height={300}
            />
          </ChartCard>
        </>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Risk data requires financial_account_updates (DW004)"
        />
      )}

      {/* Balance Exposure by DPD Bucket */}
      {balanceExposure ? (
        <ChartCard
          title="Balance Exposure by DPD Bucket"
          subtitle="Outstanding balance (IDR) by days-past-due bucket at latest snapshot"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          liveData={exposureIsLive}
        >
          <DashboardBarChart
            data={balanceExposure}
            bars={[{ key: "balance", color: "#8b5cf6", label: "Balance (IDR)" }]}
            xAxisKey="bucket"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Balance exposure requires financial_account_updates (DW004)"
        />
      )}

      <ActionItems section="Risk" items={actionItems} />
    </div>
  );
}
