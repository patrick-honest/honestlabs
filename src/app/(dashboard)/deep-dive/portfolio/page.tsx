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

const STATUS_LABELS: Record<string, string> = {
  G: "Good",
  N: "Normal",
  B: "Blocked",
  C: "Closed",
  F: "Fraud",
  D: "Delinquent",
  W: "Write-Off",
  P: "Blocked",
  S: "Suspended",
};

const actionItems: ActionItem[] = [
  {
    id: "port-1",
    priority: "positive",
    action: "Portfolio growing steadily at ~700 net new accounts/month.",
    detail: "Active accounts reached 22.5K. Credit utilization at healthy 37.4%.",
  },
  {
    id: "port-2",
    priority: "monitor",
    action: "Credit utilization trending up from 32.5% to 37.4%.",
    detail: "Still within normal range but worth monitoring. Higher utilization may signal increased risk for some segments.",
  },
  {
    id: "port-3",
    priority: "monitor",
    action: "850 accounts in blocked status.",
    detail: "Review blocked accounts for potential reactivation or closure. Some may be resolved fraud cases.",
  },
];

export default function PortfolioPage() {
  const { period } = usePeriod();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const { dateParams } = useDateParams();

  const { data: apiData } = useSWR(
    `/api/portfolio?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  // --- Weekly snapshot trend data ---
  const snapshotTrend = useMemo(() => {
    if (!apiData?.snapshot?.length) return null;
    return (apiData.snapshot as {
      week_start: string;
      total_accounts: number;
      active_accounts: number;
      blocked_accounts: number;
      closed_accounts: number;
      avg_credit_limit: number;
      avg_balance: number;
      utilization_pct: number;
      delinquent_accounts: number;
      delinquency_rate: number;
    }[]).map((r) => ({
      date: r.week_start.replace("2025-", "").replace("2026-", "").slice(0, 5),
      totalAccounts: r.total_accounts,
      activeAccounts: r.active_accounts,
      blockedAccounts: r.blocked_accounts,
      closedAccounts: r.closed_accounts,
      avgCreditLimit: r.avg_credit_limit,
      avgBalance: r.avg_balance,
      utilizationPct: r.utilization_pct,
      delinquentAccounts: r.delinquent_accounts,
      delinquencyRate: r.delinquency_rate,
    }));
  }, [apiData]);

  const snapshotIsLive = !!snapshotTrend?.length;
  const latestSnap = snapshotTrend?.[snapshotTrend.length - 1] ?? null;
  const prevSnap = snapshotTrend && snapshotTrend.length >= 2 ? snapshotTrend[snapshotTrend.length - 2] : null;

  // --- Account status breakdown ---
  const statusBarData = useMemo(() => {
    if (!apiData?.statusBreakdown?.length) return null;
    return (apiData.statusBreakdown as { status: string; accounts: number }[]).map((r) => ({
      label: STATUS_LABELS[r.status] ?? r.status,
      accounts: r.accounts,
    }));
  }, [apiData]);

  const statusIsLive = !!statusBarData?.length;

  // --- Credit limit distribution ---
  const creditLimitBarData = useMemo(() => {
    if (!apiData?.creditLimitDist?.length) return null;
    return (apiData.creditLimitDist as { bucket: string; accounts: number }[]).map((r) => ({
      label: r.bucket,
      accounts: r.accounts,
    }));
  }, [apiData]);

  const creditLimitIsLive = !!creditLimitBarData?.length;

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI Row + Charts from weekly snapshot */}
      {snapshotTrend && latestSnap ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              metricKey="portfolio_total_accounts"
              label="Total Accounts"
              value={latestSnap.totalAccounts}
              prevValue={prevSnap?.totalAccounts ?? null}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={snapshotIsLive}
            />
            <MetricCard
              metricKey="portfolio_active_accounts"
              label="Active Accounts"
              value={latestSnap.activeAccounts}
              prevValue={prevSnap?.activeAccounts ?? null}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={snapshotIsLive}
            />
            <MetricCard
              metricKey="portfolio_avg_credit_limit"
              label="Avg Credit Limit"
              value={latestSnap.avgCreditLimit}
              prevValue={prevSnap?.avgCreditLimit ?? null}
              unit="idr"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={snapshotIsLive}
            />
            <MetricCard
              metricKey="portfolio_utilization"
              label="Utilization %"
              value={latestSnap.utilizationPct}
              prevValue={prevSnap?.utilizationPct ?? null}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={snapshotIsLive}
            />
          </div>

          {/* Active Accounts Trend */}
          <ChartCard
            title="Active Accounts Trend"
            subtitle="Weekly active account count (status G or N)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={snapshotIsLive}
          >
            <DashboardLineChart
              data={snapshotTrend}
              lines={[{ key: "activeAccounts", color: "#3b82f6", label: "Active Accounts" }]}
              xAxisKey="date"
              height={300}
            />
          </ChartCard>

          {/* Credit Utilization Trend */}
          <ChartCard
            title="Credit Utilization Trend"
            subtitle="Portfolio-level credit utilization % (balance / limit)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={snapshotIsLive}
          >
            <DashboardLineChart
              data={snapshotTrend}
              lines={[{ key: "utilizationPct", color: "#8b5cf6", label: "Utilization %" }]}
              xAxisKey="date"
              valueType="percent"
              height={300}
            />
          </ChartCard>
        </>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Portfolio snapshot data requires financial_account_updates (DW004)"
        />
      )}

      {/* Account Status Breakdown */}
      {statusBarData ? (
        <ChartCard
          title="Account Status Breakdown"
          subtitle="Distribution of account statuses at latest available date"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          liveData={statusIsLive}
        >
          <DashboardBarChart
            data={statusBarData}
            bars={[{ key: "accounts", color: "#06b6d4", label: "Accounts" }]}
            xAxisKey="label"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Account status breakdown requires financial_account_updates (DW004)"
        />
      )}

      {/* Credit Limit Distribution */}
      {creditLimitBarData ? (
        <ChartCard
          title="Credit Limit Distribution"
          subtitle="Active accounts by credit limit bucket"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          liveData={creditLimitIsLive}
        >
          <DashboardBarChart
            data={creditLimitBarData}
            bars={[{ key: "accounts", color: "#22c55e", label: "Accounts" }]}
            xAxisKey="label"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Credit limit distribution requires financial_account_updates (DW004)"
        />
      )}

      <ActionItems section="Portfolio" items={actionItems} />
    </div>
  );
}
