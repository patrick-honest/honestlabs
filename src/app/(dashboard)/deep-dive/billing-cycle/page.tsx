"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------------------------------------------------------------------------
// Mock fallback data
// ---------------------------------------------------------------------------

const MOCK_OVERVIEW = [
  { cycle_day: 4, total_accounts: 266363, with_balance: 95739, revolving: 14841, revolve_rate: 15.5, avg_utilization: 72.3, avg_balance_idr: 1791977, avg_limit_idr: 3824300, avg_dpd: 12.3 },
  { cycle_day: 26, total_accounts: 165107, with_balance: 31803, revolving: 26625, revolve_rate: 83.7, avg_utilization: 68.9, avg_balance_idr: 455879, avg_limit_idr: 1252600, avg_dpd: 8.1 },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillingCyclePage() {
  const { period, dateRange } = usePeriod();
  const { dateParams } = useDateParams();
  const { isDark } = useTheme();
  const { filters } = useFilters();

  // Fetch real data from BigQuery
  const { data: apiData } = useSWR(
    `/api/billing-cycle?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  // ── Overview KPIs ──────────────────────────────────────────────────

  const overview = useMemo(() => {
    return apiData?.overview?.length ? apiData.overview : MOCK_OVERVIEW;
  }, [apiData]);

  const cycle4 = useMemo(() => overview.find((r: { cycle_day: number }) => r.cycle_day === 4), [overview]);
  const cycle26 = useMemo(() => overview.find((r: { cycle_day: number }) => r.cycle_day === 26), [overview]);

  const totalActive = (cycle4?.total_accounts ?? 0) + (cycle26?.total_accounts ?? 0);
  const totalRevolving = (cycle4?.revolving ?? 0) + (cycle26?.revolving ?? 0);
  const totalWithBalance = (cycle4?.with_balance ?? 0) + (cycle26?.with_balance ?? 0);
  const overallRevolveRate = totalWithBalance > 0 ? (totalRevolving / totalWithBalance * 100) : 0;
  const avgUtilization = ((cycle4?.avg_utilization ?? 0) + (cycle26?.avg_utilization ?? 0)) / 2;
  const avgBalance = ((cycle4?.avg_balance_idr ?? 0) + (cycle26?.avg_balance_idr ?? 0)) / 2;

  // ── Revolve Rate Trend ─────────────────────────────────────────────

  const revolveTrendData = useMemo(() => {
    if (!apiData?.revolveTrend?.length) return [];
    const months = [...new Set(apiData.revolveTrend.map((r: { month: string }) => r.month))].sort();
    return months.map((m) => {
      const c4 = apiData.revolveTrend.find((r: { month: string; cycle_day: number }) => r.month === m && r.cycle_day === 4);
      const c26 = apiData.revolveTrend.find((r: { month: string; cycle_day: number }) => r.month === m && r.cycle_day === 26);
      return {
        date: (m as string).replace("2025-", "").replace("2026-", ""),
        "Cycle 4th": c4?.revolve_rate ?? 0,
        "Cycle 26th": c26?.revolve_rate ?? 0,
      };
    });
  }, [apiData]);

  // ── Utilization Distribution ───────────────────────────────────────

  const utilizationData = useMemo(() => {
    if (!apiData?.utilizationDistribution?.length) return [];
    const buckets = ["No Balance", "0-25%", "25-50%", "50-75%", "75-100%", ">100%"];
    return buckets.map((b) => {
      const c4 = apiData.utilizationDistribution.find((r: { cycle_day: number; bucket: string }) => r.cycle_day === 4 && r.bucket === b);
      const c26 = apiData.utilizationDistribution.find((r: { cycle_day: number; bucket: string }) => r.cycle_day === 26 && r.bucket === b);
      return {
        bucket: b,
        "Cycle 4th": c4?.pct ?? 0,
        "Cycle 26th": c26?.pct ?? 0,
      };
    });
  }, [apiData]);

  // ── DPD Distribution ───────────────────────────────────────────────

  const dpdData = useMemo(() => {
    if (!apiData?.dpdDistribution?.length) return [];
    const buckets = ["Current", "1-30 DPD", "31-60 DPD", "61-90 DPD", "90+ DPD"];
    return buckets.map((b) => {
      const c4 = apiData.dpdDistribution.find((r: { cycle_day: number; bucket: string }) => r.cycle_day === 4 && r.bucket === b);
      const c26 = apiData.dpdDistribution.find((r: { cycle_day: number; bucket: string }) => r.cycle_day === 26 && r.bucket === b);
      return {
        bucket: b,
        "Cycle 4th": c4?.pct ?? 0,
        "Cycle 26th": c26?.pct ?? 0,
      };
    });
  }, [apiData]);

  // ── Balance Trend ──────────────────────────────────────────────────

  const balanceTrendData = useMemo(() => {
    if (!apiData?.balanceTrend?.length) return [];
    const months = [...new Set(apiData.balanceTrend.map((r: { month: string }) => r.month))].sort();
    return months.map((m) => {
      const c4 = apiData.balanceTrend.find((r: { month: string; cycle_day: number }) => r.month === m && r.cycle_day === 4);
      const c26 = apiData.balanceTrend.find((r: { month: string; cycle_day: number }) => r.month === m && r.cycle_day === 26);
      return {
        date: (m as string).replace("2025-", "").replace("2026-", ""),
        "Cycle 4th": Math.round((c4?.avg_balance_idr ?? 0) / 1000),
        "Cycle 26th": Math.round((c26?.avg_balance_idr ?? 0) / 1000),
      };
    });
  }, [apiData]);

  // ── Payment Behavior ───────────────────────────────────────────────

  const paymentBehaviorData = useMemo(() => {
    if (!apiData?.paymentBehavior?.length) return [];
    const behaviors = ["Paid in Full", "Min Payment Made", "Below Min Due", "Past Due", "Other"];
    return behaviors.map((b) => {
      const c4 = apiData.paymentBehavior.find((r: { cycle_day: number; behavior: string }) => r.cycle_day === 4 && r.behavior === b);
      const c26 = apiData.paymentBehavior.find((r: { cycle_day: number; behavior: string }) => r.cycle_day === 26 && r.behavior === b);
      return {
        behavior: b,
        "Cycle 4th": c4?.pct ?? 0,
        "Cycle 26th": c26?.pct ?? 0,
        c4_accounts: c4?.accounts ?? 0,
        c26_accounts: c26?.accounts ?? 0,
      };
    }).filter((d) => d["Cycle 4th"] > 0 || d["Cycle 26th"] > 0);
  }, [apiData]);

  // ── Insights ───────────────────────────────────────────────────────

  const overviewInsights: ChartInsight[] = useMemo(() => [
    {
      text: `Cycle 26th has ${((cycle26?.revolve_rate ?? 0)).toFixed(1)}% revolve rate vs ${((cycle4?.revolve_rate ?? 0)).toFixed(1)}% for Cycle 4th — significantly higher revolving behavior.`,
      type: cycle26?.revolve_rate > cycle4?.revolve_rate ? "negative" : "positive",
    },
    {
      text: `Cycle 4th accounts outnumber Cycle 26th ${((cycle4?.total_accounts ?? 0) / 1000).toFixed(0)}K to ${((cycle26?.total_accounts ?? 0) / 1000).toFixed(0)}K (${(((cycle4?.total_accounts ?? 0) / totalActive) * 100).toFixed(0)}% vs ${(((cycle26?.total_accounts ?? 0) / totalActive) * 100).toFixed(0)}%).`,
      type: "neutral",
    },
    {
      text: `Average outstanding balance: Cycle 4th IDR ${((cycle4?.avg_balance_idr ?? 0) / 1e6).toFixed(1)}M vs Cycle 26th IDR ${((cycle26?.avg_balance_idr ?? 0) / 1e6).toFixed(1)}M.`,
      type: "neutral",
    },
    {
      text: "The cycle-day difference in revolve rate may reflect different user demographics or onboarding cohorts assigned to each cycle.",
      type: "hypothesis",
    },
  ], [cycle4, cycle26, totalActive]);

  return (
    <div className="space-y-6 mt-4">
      <ActiveFiltersBanner />

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          metricKey="billing_active_accounts"
          label="Active Accounts"
          value={totalActive}
          unit="count"
          asOf={apiData?.asOf ?? ""}
          dataRange={apiData?.dataRange ?? { start: "", end: "" }}
        />
        <MetricCard
          metricKey="billing_revolve_rate"
          label="Revolve Rate"
          value={overallRevolveRate}
          unit="percent"
          asOf={apiData?.asOf ?? ""}
          dataRange={apiData?.dataRange ?? { start: "", end: "" }}
        />
        <MetricCard
          metricKey="billing_avg_utilization"
          label="Avg Utilization"
          value={avgUtilization}
          unit="percent"
          asOf={apiData?.asOf ?? ""}
          dataRange={apiData?.dataRange ?? { start: "", end: "" }}
        />
        <MetricCard
          metricKey="billing_avg_balance"
          label="Avg Balance"
          value={avgBalance}
          unit="idr"
          asOf={apiData?.asOf ?? ""}
          dataRange={apiData?.dataRange ?? { start: "", end: "" }}
        />
      </div>

      <ChartInsights insights={overviewInsights} />

      {/* Charts Row 1: Revolve Rate Trend + Utilization */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Revolve Rate Trend by Cycle" subtitle="Monthly revolve rate (%) — revolvers / accounts with balance" asOf={apiData?.asOf ?? ""} dataRange={apiData?.dataRange ?? { start: "", end: "" }}>
          {revolveTrendData.length > 0 ? (
            <DashboardLineChart
              data={revolveTrendData}
              xAxisKey="date"
              lines={[
                { key: "Cycle 4th", label: "Cycle 4th", color: isDark ? "#7C4DFF" : "#D00083" },
                { key: "Cycle 26th", label: "Cycle 26th", color: isDark ? "#06D6A0" : "#059669" },
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
                { key: "Cycle 4th", label: "Cycle 4th", color: isDark ? "#7C4DFF" : "#D00083" },
                { key: "Cycle 26th", label: "Cycle 26th", color: isDark ? "#06D6A0" : "#059669" },
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
                { key: "Cycle 4th", label: "Cycle 4th", color: isDark ? "#7C4DFF" : "#D00083" },
                { key: "Cycle 26th", label: "Cycle 26th", color: isDark ? "#06D6A0" : "#059669" },
              ]}
              height={280}
            />
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic py-8 text-center">Loading data from BigQuery…</p>
          )}
        </ChartCard>

        <ChartCard title="Avg Balance Trend" subtitle="Monthly average outstanding balance (IDR thousands) by cycle" asOf={apiData?.asOf ?? ""} dataRange={apiData?.dataRange ?? { start: "", end: "" }}>
          {balanceTrendData.length > 0 ? (
            <DashboardLineChart
              data={balanceTrendData}
              xAxisKey="date"
              lines={[
                { key: "Cycle 4th", label: "Cycle 4th", color: isDark ? "#7C4DFF" : "#D00083" },
                { key: "Cycle 26th", label: "Cycle 26th", color: isDark ? "#06D6A0" : "#059669" },
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
              { key: "Cycle 4th", label: "Cycle 4th", color: isDark ? "#7C4DFF" : "#D00083" },
              { key: "Cycle 26th", label: "Cycle 26th", color: isDark ? "#06D6A0" : "#059669" },
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
                <th className="pb-2 text-right font-medium">Cycle 4th</th>
                <th className="pb-2 text-right font-medium">Cycle 26th</th>
                <th className="pb-2 text-right font-medium">Combined</th>
              </tr>
            </thead>
            <tbody className="text-[var(--text-secondary)]">
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">Active Accounts</td>
                <td className="py-2 text-right font-mono">{(cycle4?.total_accounts ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono">{(cycle26?.total_accounts ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{totalActive.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">With Balance</td>
                <td className="py-2 text-right font-mono">{(cycle4?.with_balance ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono">{(cycle26?.with_balance ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{totalWithBalance.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">Revolving</td>
                <td className="py-2 text-right font-mono">{(cycle4?.revolving ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono">{(cycle26?.revolving ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{totalRevolving.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">Revolve Rate</td>
                <td className="py-2 text-right font-mono">{(cycle4?.revolve_rate ?? 0).toFixed(1)}%</td>
                <td className="py-2 text-right font-mono">{(cycle26?.revolve_rate ?? 0).toFixed(1)}%</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{overallRevolveRate.toFixed(1)}%</td>
              </tr>
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">Avg Utilization</td>
                <td className="py-2 text-right font-mono">{(cycle4?.avg_utilization ?? 0).toFixed(1)}%</td>
                <td className="py-2 text-right font-mono">{(cycle26?.avg_utilization ?? 0).toFixed(1)}%</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{avgUtilization.toFixed(1)}%</td>
              </tr>
              <tr className="border-b border-[var(--border)]/30">
                <td className="py-2 font-medium">Avg Balance (IDR)</td>
                <td className="py-2 text-right font-mono">Rp {((cycle4?.avg_balance_idr ?? 0) / 1e6).toFixed(1)}M</td>
                <td className="py-2 text-right font-mono">Rp {((cycle26?.avg_balance_idr ?? 0) / 1e6).toFixed(1)}M</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">Rp {(avgBalance / 1e6).toFixed(1)}M</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Avg DPD (delinquent only)</td>
                <td className="py-2 text-right font-mono">{(cycle4?.avg_dpd ?? 0).toFixed(1)}</td>
                <td className="py-2 text-right font-mono">{(cycle26?.avg_dpd ?? 0).toFixed(1)}</td>
                <td className="py-2 text-right font-mono font-semibold text-[var(--text-primary)]">{(((cycle4?.avg_dpd ?? 0) + (cycle26?.avg_dpd ?? 0)) / 2).toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
