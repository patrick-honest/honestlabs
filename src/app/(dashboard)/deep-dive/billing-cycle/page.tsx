"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import type { ChartIncrement } from "@/components/dashboard/chart-card";
import { aggregateByIncrement } from "@/lib/aggregate-by-increment";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { ChartSkeleton, MetricCardsSkeleton } from "@/components/dashboard/chart-skeleton";
import { usePeriod } from "@/hooks/use-period";
import { useApiParams } from "@/hooks/use-api-params";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { PrintStyles } from "@/components/layout/print-styles";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillingCyclePage() {
  const { period, dateRange } = usePeriod();
  const { apiParams } = useApiParams();
  const { isDark } = useTheme();

  // Fetch real data from BigQuery
  const { data: apiData, isLoading } = useSWR(
    `/api/billing-cycle?${apiParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const billingIsLive = !!apiData?.overview?.length;

  // ── Overview KPIs ──────────────────────────────────────────────────

  const overview = useMemo(() => {
    return apiData?.overview?.length ? apiData.overview : null;
  }, [apiData]);

  const cycle10 = useMemo(() => overview?.find((r: { cycle_day: number }) => r.cycle_day === 10) ?? null, [overview]);
  const cycle16 = useMemo(() => overview?.find((r: { cycle_day: number }) => r.cycle_day === 16) ?? null, [overview]);

  const totalActive = (cycle10?.total_accounts ?? 0) + (cycle16?.total_accounts ?? 0);
  const totalRevolving = (cycle10?.revolving ?? 0) + (cycle16?.revolving ?? 0);
  const totalWithBalance = (cycle10?.with_balance ?? 0) + (cycle16?.with_balance ?? 0);
  const overallRevolveRate = totalWithBalance > 0 ? (totalRevolving / totalWithBalance * 100) : 0;
  const avgUtilization = ((cycle10?.avg_utilization ?? 0) + (cycle16?.avg_utilization ?? 0)) / 2;
  const avgBalance = ((cycle10?.avg_balance_idr ?? 0) + (cycle16?.avg_balance_idr ?? 0)) / 2;

  // ── Revolve Rate Trend ─────────────────────────────────────────────

  const revolveTrendData = useMemo(() => {
    if (!apiData?.revolveTrend?.length) return [];
    const months = [...new Set(apiData.revolveTrend.map((r: { month: string }) => r.month))].sort();
    const raw = months.map((m) => {
      const c4 = apiData.revolveTrend.find((r: { month: string; cycle_day: number }) => r.month === m && r.cycle_day === 10);
      const c26 = apiData.revolveTrend.find((r: { month: string; cycle_day: number }) => r.month === m && r.cycle_day === 16);
      return {
        date: (m as string).replace("2025-", "").replace("2026-", ""),
        "Cycle 10th": c4?.revolve_rate ?? 0,
        "Cycle 16th": c26?.revolve_rate ?? 0,
      };
    });
    return raw;
  }, [apiData]);

  // ── Utilization Distribution ───────────────────────────────────────

  const utilizationData = useMemo(() => {
    if (!apiData?.utilizationDistribution?.length) return [];
    const buckets = ["No Balance", "0-25%", "25-50%", "50-75%", "75-100%", ">100%"];
    const raw = buckets.map((b) => {
      const c4 = apiData.utilizationDistribution.find((r: { cycle_day: number; bucket: string }) => r.cycle_day === 10 && r.bucket === b);
      const c26 = apiData.utilizationDistribution.find((r: { cycle_day: number; bucket: string }) => r.cycle_day === 16 && r.bucket === b);
      return {
        bucket: b,
        "Cycle 10th": c4?.pct ?? 0,
        "Cycle 16th": c26?.pct ?? 0,
      };
    });
    return raw;
  }, [apiData]);

  // ── DPD Distribution ───────────────────────────────────────────────

  const dpdData = useMemo(() => {
    if (!apiData?.dpdDistribution?.length) return [];
    const buckets = ["Current", "1-30 DPD", "31-60 DPD", "61-90 DPD", "90+ DPD"];
    const raw = buckets.map((b) => {
      const c4 = apiData.dpdDistribution.find((r: { cycle_day: number; bucket: string }) => r.cycle_day === 10 && r.bucket === b);
      const c26 = apiData.dpdDistribution.find((r: { cycle_day: number; bucket: string }) => r.cycle_day === 16 && r.bucket === b);
      return {
        bucket: b,
        "Cycle 10th": c4?.pct ?? 0,
        "Cycle 16th": c26?.pct ?? 0,
      };
    });
    return raw;
  }, [apiData]);

  // ── Balance Trend ──────────────────────────────────────────────────

  const balanceTrendData = useMemo(() => {
    if (!apiData?.balanceTrend?.length) return [];
    const months = [...new Set(apiData.balanceTrend.map((r: { month: string }) => r.month))].sort();
    const raw = months.map((m) => {
      const c4 = apiData.balanceTrend.find((r: { month: string; cycle_day: number }) => r.month === m && r.cycle_day === 10);
      const c26 = apiData.balanceTrend.find((r: { month: string; cycle_day: number }) => r.month === m && r.cycle_day === 16);
      return {
        date: (m as string).replace("2025-", "").replace("2026-", ""),
        "Cycle 10th": Math.round((c4?.avg_balance_idr ?? 0) / 1000),
        "Cycle 16th": Math.round((c26?.avg_balance_idr ?? 0) / 1000),
      };
    });
    return raw;
  }, [apiData]);

  // ── Payment Behavior ───────────────────────────────────────────────

  const paymentBehaviorData = useMemo(() => {
    if (!apiData?.paymentBehavior?.length) return [];
    const behaviors = ["Paid in Full", "Min Payment Made", "Below Min Due", "Past Due", "Other"];
    const raw = behaviors.map((b) => {
      const c4 = apiData.paymentBehavior.find((r: { cycle_day: number; behavior: string }) => r.cycle_day === 10 && r.behavior === b);
      const c26 = apiData.paymentBehavior.find((r: { cycle_day: number; behavior: string }) => r.cycle_day === 16 && r.behavior === b);
      return {
        behavior: b,
        "Cycle 10th": c4?.pct ?? 0,
        "Cycle 16th": c26?.pct ?? 0,
        c4_accounts: c4?.accounts ?? 0,
        c26_accounts: c26?.accounts ?? 0,
      };
    }).filter((d) => d["Cycle 10th"] > 0 || d["Cycle 16th"] > 0);
    return raw;
  }, [apiData]);

  // ── Insights ───────────────────────────────────────────────────────

  const overviewInsights: ChartInsight[] = useMemo(() => [
    {
      text: `Cycle 16th has ${((cycle16?.revolve_rate ?? 0)).toFixed(1)}% revolve rate vs ${((cycle10?.revolve_rate ?? 0)).toFixed(1)}% for Cycle 10th — significantly higher revolving behavior.`,
      type: cycle16?.revolve_rate > cycle10?.revolve_rate ? "negative" : "positive",
    },
    {
      text: `Cycle 10th accounts outnumber Cycle 16th ${((cycle10?.total_accounts ?? 0) / 1000).toFixed(0)}K to ${((cycle16?.total_accounts ?? 0) / 1000).toFixed(0)}K (${(((cycle10?.total_accounts ?? 0) / totalActive) * 100).toFixed(0)}% vs ${(((cycle16?.total_accounts ?? 0) / totalActive) * 100).toFixed(0)}%).`,
      type: "neutral",
    },
    {
      text: `Average outstanding balance: Cycle 10th IDR ${((cycle10?.avg_balance_idr ?? 0) / 1e6).toFixed(1)}M vs Cycle 16th IDR ${((cycle16?.avg_balance_idr ?? 0) / 1e6).toFixed(1)}M.`,
      type: "neutral",
    },
    {
      text: "The cycle-day difference in revolve rate may reflect different user demographics or onboarding cohorts assigned to each cycle.",
      type: "hypothesis",
    },
  ], [cycle10, cycle16, totalActive]);

  return (
    <div className="space-y-6 mt-4">
      <PrintStyles />
      <ActiveFiltersBanner />

      {!overview && (
        isLoading ? (
          <><MetricCardsSkeleton /><ChartSkeleton /><ChartSkeleton /></>
        ) : (
          <SampleDataBanner
            dataset="mart_finexus"
            reason="Billing cycle data requires financial_account_updates (DW004)"
          />
        )
      )}

      {overview && <>
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          metricKey="billing_active_accounts"
          label="Active Accounts"
          value={totalActive}
          unit="count"
          asOf={apiData?.asOf ?? ""}
          dataRange={apiData?.dataRange ?? { start: "", end: "" }}
          liveData={billingIsLive}
        />
        <MetricCard
          metricKey="billing_revolve_rate"
          label="Revolve Rate"
          value={overallRevolveRate}
          unit="percent"
          asOf={apiData?.asOf ?? ""}
          dataRange={apiData?.dataRange ?? { start: "", end: "" }}
          liveData={billingIsLive}
        />
        <MetricCard
          metricKey="billing_avg_utilization"
          label="Avg Utilization"
          value={avgUtilization}
          unit="percent"
          asOf={apiData?.asOf ?? ""}
          dataRange={apiData?.dataRange ?? { start: "", end: "" }}
          liveData={billingIsLive}
        />
        <MetricCard
          metricKey="billing_avg_balance"
          label="Avg Balance"
          value={avgBalance}
          unit="idr"
          asOf={apiData?.asOf ?? ""}
          dataRange={apiData?.dataRange ?? { start: "", end: "" }}
          liveData={billingIsLive}
        />
      </div>

      <ChartInsights insights={overviewInsights} />

      {/* Charts Row 1: Revolve Rate Trend + Utilization */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Revolve Rate Trend by Cycle" subtitle="Revolve rate (%) — revolvers / accounts with balance" asOf={apiData?.asOf ?? ""} dataRange={apiData?.dataRange ?? { start: "", end: "" }} showIncrement>
          {(increment: ChartIncrement) => revolveTrendData.length > 0 ? (
            <DashboardLineChart
              data={aggregateByIncrement(revolveTrendData, increment, "date")}
              xAxisKey="date"
              lines={[
                { key: "Cycle 10th", label: "Cycle 10th", color: isDark ? "#7C4DFF" : "#D00083" },
                { key: "Cycle 16th", label: "Cycle 16th", color: isDark ? "#06D6A0" : "#059669" },
              ]}
              height={280}
            />
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic py-8 text-center">Loading data from BigQuery…</p>
          )}
        </ChartCard>

        <ChartCard title="Utilization Distribution" subtitle="Credit utilization buckets by cycle cohort (%)" asOf={apiData?.asOf ?? ""} dataRange={apiData?.dataRange ?? { start: "", end: "" }}>
          {utilizationData.length > 0 ? (
            <DashboardBarChart
              data={utilizationData}
              xAxisKey="bucket"
              bars={[
                { key: "Cycle 10th", label: "Cycle 10th", color: isDark ? "#7C4DFF" : "#D00083" },
                { key: "Cycle 16th", label: "Cycle 16th", color: isDark ? "#06D6A0" : "#059669" },
              ]}
              height={280}
            />
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic py-8 text-center">Loading data from BigQuery…</p>
          )}
        </ChartCard>
      </div>

      {/* Charts Row 2: DPD + Balance Trend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="DPD Distribution by Cycle" subtitle="Days past due buckets by cycle cohort (%)" asOf={apiData?.asOf ?? ""} dataRange={apiData?.dataRange ?? { start: "", end: "" }}>
          {dpdData.length > 0 ? (
            <DashboardBarChart
              data={dpdData}
              xAxisKey="bucket"
              bars={[
                { key: "Cycle 10th", label: "Cycle 10th", color: isDark ? "#7C4DFF" : "#D00083" },
                { key: "Cycle 16th", label: "Cycle 16th", color: isDark ? "#06D6A0" : "#059669" },
              ]}
              height={280}
            />
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic py-8 text-center">Loading data from BigQuery…</p>
          )}
        </ChartCard>

        <ChartCard title="Avg Balance Trend" subtitle="Average outstanding balance (IDR thousands) by cycle" asOf={apiData?.asOf ?? ""} dataRange={apiData?.dataRange ?? { start: "", end: "" }} showIncrement>
          {(increment: ChartIncrement) => balanceTrendData.length > 0 ? (
            <DashboardLineChart
              data={aggregateByIncrement(balanceTrendData, increment, "date")}
              xAxisKey="date"
              lines={[
                { key: "Cycle 10th", label: "Cycle 10th", color: isDark ? "#7C4DFF" : "#D00083" },
                { key: "Cycle 16th", label: "Cycle 16th", color: isDark ? "#06D6A0" : "#059669" },
              ]}
              height={280}
            />
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic py-8 text-center">Loading data from BigQuery…</p>
          )}
        </ChartCard>
      </div>

      {/* Payment Behavior */}
      <ChartCard title="Payment Behavior by Cycle" subtitle="How accounts handle their statement balance" asOf={apiData?.asOf ?? ""} dataRange={apiData?.dataRange ?? { start: "", end: "" }}>
        {paymentBehaviorData.length > 0 ? (
          <DashboardBarChart
            data={paymentBehaviorData}
            xAxisKey="behavior"
            bars={[
              { key: "Cycle 10th", label: "Cycle 10th", color: isDark ? "#7C4DFF" : "#D00083" },
              { key: "Cycle 16th", label: "Cycle 16th", color: isDark ? "#06D6A0" : "#059669" },
            ]}
            height={300}
          />
        ) : (
          <p className="text-xs text-[var(--text-muted)] italic py-8 text-center">Loading data from BigQuery…</p>
        )}
      </ChartCard>

      {/* Cycle Cohort Comparison Table */}
      <div className={cn(
        "rounded-xl border p-5",
        isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-white"
      )}>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Cycle Cohort Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="pb-2 text-left font-medium w-40">Metric</th>
                <th className="pb-2 text-right font-medium">Cycle 10th</th>
                <th className="pb-2 text-right font-medium">Cycle 16th</th>
                <th className="pb-2 text-right font-medium">Combined</th>
              </tr>
            </thead>
            <tbody className="text-[var(--text-secondary)]">
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">Active Accounts</td>
                <td className="py-2 text-right font-mono">{(cycle10?.total_accounts ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono">{(cycle16?.total_accounts ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{totalActive.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">With Balance</td>
                <td className="py-2 text-right font-mono">{(cycle10?.with_balance ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono">{(cycle16?.with_balance ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{totalWithBalance.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">Revolving</td>
                <td className="py-2 text-right font-mono">{(cycle10?.revolving ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono">{(cycle16?.revolving ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{totalRevolving.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">Revolve Rate</td>
                <td className="py-2 text-right font-mono">{(cycle10?.revolve_rate ?? 0).toFixed(1)}%</td>
                <td className="py-2 text-right font-mono">{(cycle16?.revolve_rate ?? 0).toFixed(1)}%</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{overallRevolveRate.toFixed(1)}%</td>
              </tr>
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">Avg Utilization</td>
                <td className="py-2 text-right font-mono">{(cycle10?.avg_utilization ?? 0).toFixed(1)}%</td>
                <td className="py-2 text-right font-mono">{(cycle16?.avg_utilization ?? 0).toFixed(1)}%</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{avgUtilization.toFixed(1)}%</td>
              </tr>
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">Avg Balance (IDR)</td>
                <td className="py-2 text-right font-mono">Rp {((cycle10?.avg_balance_idr ?? 0) / 1e6).toFixed(1)}M</td>
                <td className="py-2 text-right font-mono">Rp {((cycle16?.avg_balance_idr ?? 0) / 1e6).toFixed(1)}M</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">Rp {(avgBalance / 1e6).toFixed(1)}M</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Avg DPD (delinquent only)</td>
                <td className="py-2 text-right font-mono">{(cycle10?.avg_dpd ?? 0).toFixed(1)}</td>
                <td className="py-2 text-right font-mono">{(cycle16?.avg_dpd ?? 0).toFixed(1)}</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{(((cycle10?.avg_dpd ?? 0) + (cycle16?.avg_dpd ?? 0)) / 2).toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      </>}
    </div>
  );
}
