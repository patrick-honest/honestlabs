"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import type { ChartIncrement } from "@/components/dashboard/chart-card";
import { aggregateByIncrement } from "@/lib/aggregate-by-increment";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { ChartSkeleton, MetricCardsSkeleton } from "@/components/dashboard/chart-skeleton";
import { usePeriod } from "@/hooks/use-period";
import { useApiParams } from "@/hooks/use-api-params";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange } from "@/lib/period-data";
import { useTranslations } from "next-intl";
import { PrintStyles } from "@/components/layout/print-styles";

const AS_OF = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const { apiParams } = useApiParams();
  const tPort = useTranslations("portfolio");

  const { data: apiData, isLoading } = useSWR(
    `/api/portfolio?${apiParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  // --- Weekly snapshot trend data ---
  const snapshotTrend = useMemo(() => {
    if (!apiData?.snapshot?.length) return null;
    const raw = (apiData.snapshot as {
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
    return raw;
  }, [apiData]);

  const snapshotIsLive = !!snapshotTrend?.length;
  const latestSnap = snapshotTrend?.[snapshotTrend.length - 1] ?? null;
  const prevSnap = snapshotTrend && snapshotTrend.length >= 2 ? snapshotTrend[snapshotTrend.length - 2] : null;

  // --- Account status breakdown ---
  const statusBarData = useMemo(() => {
    if (!apiData?.statusBreakdown?.length) return null;
    const raw = (apiData.statusBreakdown as { status: string; accounts: number }[]).map((r) => ({
      label: STATUS_LABELS[r.status] ?? r.status,
      accounts: r.accounts,
    }));
    return raw;
  }, [apiData]);

  const statusIsLive = !!statusBarData?.length;

  // --- Credit limit distribution ---
  const creditLimitBarData = useMemo(() => {
    if (!apiData?.creditLimitDist?.length) return null;
    const raw = (apiData.creditLimitDist as { bucket: string; accounts: number }[]).map((r) => ({
      label: r.bucket,
      accounts: r.accounts,
    }));
    return raw;
  }, [apiData]);

  const creditLimitIsLive = !!creditLimitBarData?.length;

  // --- Revolve Rate Trend ---
  const revolveRateTrend = useMemo(() => {
    if (!apiData?.revolveRateTrend?.length) return null;
    return (apiData.revolveRateTrend as {
      month: string;
      cnt_accounts: number;
      cnt_revolving: number;
      revolve_rate_count_pct: number;
      revolve_rate_balance_pct: number;
      statement_opening_balance: number;
      total_billed_outstanding: number;
    }[]).map((r) => ({
      date: r.month,
      revolveRateCount: r.revolve_rate_count_pct,
      revolveRateBalance: r.revolve_rate_balance_pct,
      accounts: r.cnt_accounts,
      revolving: r.cnt_revolving,
    }));
  }, [apiData]);

  const revolveIsLive = !!revolveRateTrend?.length;
  const latestRevolve = revolveRateTrend?.[revolveRateTrend.length - 1] ?? null;
  const prevRevolve = revolveRateTrend && revolveRateTrend.length >= 2 ? revolveRateTrend[revolveRateTrend.length - 2] : null;

  return (
    <div className="space-y-6">
      <PrintStyles />
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
            subtitle="Active account count (status G or N)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={snapshotIsLive}
            showIncrement
          >
            {(increment: ChartIncrement) => (
              <DashboardLineChart
                data={aggregateByIncrement(snapshotTrend, increment, "date")}
                lines={[{ key: "activeAccounts", color: "#3b82f6", label: "Active Accounts" }]}
                xAxisKey="date"
                height={300}
              />
            )}
          </ChartCard>

          {/* Credit Utilization Trend */}
          <ChartCard
            title="Credit Utilization Trend"
            subtitle="Portfolio-level credit utilization % (balance / limit)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={snapshotIsLive}
            showIncrement
          >
            {(increment: ChartIncrement) => (
              <DashboardLineChart
                data={aggregateByIncrement(snapshotTrend, increment, "date")}
                lines={[{ key: "utilizationPct", color: "#8b5cf6", label: "Utilization %" }]}
                xAxisKey="date"
                valueType="percent"
                height={300}
              />
            )}
          </ChartCard>
        </>
      ) : isLoading ? (
        <><MetricCardsSkeleton /><ChartSkeleton /><ChartSkeleton /></>
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
      ) : isLoading ? (
        <ChartSkeleton />
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
      ) : isLoading ? (
        <ChartSkeleton />
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Credit limit distribution requires financial_account_updates (DW004)"
        />
      )}

      {/* ================================================================== */}
      {/* Revolve & Fee Analysis                                             */}
      {/* ================================================================== */}
      <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mt-8">
        <span className="i-lucide-repeat w-5 h-5" aria-hidden="true" />
        {tPort("revolveAnalysis")}
      </h2>

      {revolveRateTrend && latestRevolve ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard
              metricKey="portfolio_revolve_rate_count"
              label={tPort("revolveRateCount")}
              value={latestRevolve.revolveRateCount}
              prevValue={prevRevolve?.revolveRateCount ?? null}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={revolveIsLive}
            />
            <MetricCard
              metricKey="portfolio_revolve_rate_balance"
              label={tPort("revolveRateBalance")}
              value={latestRevolve.revolveRateBalance}
              prevValue={prevRevolve?.revolveRateBalance ?? null}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={revolveIsLive}
            />
          </div>

          <ChartCard
            title={tPort("revolveRate")}
            subtitle="Monthly revolve rate — count-based and balance-based"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={revolveIsLive}
          >
            <DashboardLineChart
              data={revolveRateTrend}
              lines={[
                { key: "revolveRateCount", color: "#8b5cf6", label: "Revolve Rate (Count) %" },
                { key: "revolveRateBalance", color: "#06b6d4", label: "Revolve Rate (Balance) %" },
              ]}
              xAxisKey="date"
              valueType="percent"
              height={300}
            />
          </ChartCard>
        </>
      ) : isLoading ? (
        <><MetricCardsSkeleton /><ChartSkeleton /></>
      ) : (
        <SampleDataBanner
          dataset="sandbox_risk"
          reason="Revolve rate requires financial_account_updates + account_dpd_block_date tables"
        />
      )}

      <ActionItems section="Portfolio" items={actionItems} />
    </div>
  );
}
