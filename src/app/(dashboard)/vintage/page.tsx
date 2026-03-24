"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Header } from "@/components/layout/header";
import { useTranslations } from "next-intl";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DashboardLineChart } from "@/components/charts/line-chart";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const AS_OF = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

interface DpdAppMonthRow {
  month_key: string;
  c1_pd30_obs: number;
  c1_pd30: number;
  v1_pd4_rate: number;
  v1_pd10_rate: number;
  v1_pd30_rate: number;
}

interface DpdFirstStmtRow {
  month_key: string;
  c1_pd30_obs: number;
  c1_pd30: number;
  c1_pd30_rate: number;
  v1_pd30_rate: number;
}

interface CureRateRow {
  month_key: string;
  cure_rate_pct: number;
  cumul_cured: number;
  total_bal: number;
}

export default function VintagePage() {
  const { periodLabel } = usePeriod();
  const { dateParams } = useDateParams();
  const { isDark } = useTheme();
  const tNav = useTranslations("nav");

  const { data: apiData, isLoading } = useSWR<{
    dpdByAppMonth?: DpdAppMonthRow[];
    dpdByFirstStatement?: DpdFirstStmtRow[];
    cureRate?: CureRateRow[];
  }>(`/api/vintage?${dateParams}`, fetcher, { revalidateOnFocus: false });

  // Transform DPD by App Month for line chart
  const dpdAppMonthData = useMemo(() => {
    if (!apiData?.dpdByAppMonth?.length) return null;
    return apiData.dpdByAppMonth.map(r => ({
      date: r.month_key,
      pd4: r.v1_pd4_rate ?? 0,
      pd10: r.v1_pd10_rate ?? 0,
      pd30: r.v1_pd30_rate ?? 0,
      accounts: r.c1_pd30_obs,
      delinquent: r.c1_pd30,
    }));
  }, [apiData]);

  // Transform DPD by First Statement
  const dpdFirstStmtData = useMemo(() => {
    if (!apiData?.dpdByFirstStatement?.length) return null;
    return apiData.dpdByFirstStatement.map(r => ({
      date: r.month_key,
      countRate: r.c1_pd30_rate ?? 0,
      volumeRate: r.v1_pd30_rate ?? 0,
      accounts: r.c1_pd30_obs,
    }));
  }, [apiData]);

  // Transform Cure Rate
  const cureRateData = useMemo(() => {
    if (!apiData?.cureRate?.length) return null;
    return apiData.cureRate.map(r => ({
      date: r.month_key,
      cureRate: r.cure_rate_pct,
    }));
  }, [apiData]);

  // Latest values for headline KPIs
  const latestDpd = dpdAppMonthData?.[dpdAppMonthData.length - 1];
  const prevDpd = dpdAppMonthData?.[dpdAppMonthData.length - 2];
  const latestCure = cureRateData?.[cureRateData.length - 1];
  const prevCure = cureRateData?.[cureRateData.length - 2];

  const actionItems: ActionItem[] = useMemo(() => {
    const items: ActionItem[] = [];
    if (latestDpd && prevDpd) {
      const delta = latestDpd.pd30 - prevDpd.pd30;
      items.push({
        id: "vin-dpd",
        priority: delta > 0.5 ? "urgent" : delta < -0.5 ? "positive" : "monitor",
        action: `30+ DPD rate ${delta > 0 ? "increased" : "decreased"} to ${latestDpd.pd30.toFixed(2)}%`,
        detail: `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta).toFixed(2)}pp from ${prevDpd.pd30.toFixed(2)}% in the prior month. Based on ${latestDpd.accounts.toLocaleString()} observed accounts.`,
      });
    }
    if (latestCure && prevCure) {
      const delta = latestCure.cureRate - prevCure.cureRate;
      items.push({
        id: "vin-cure",
        priority: delta < -5 ? "urgent" : delta > 5 ? "positive" : "monitor",
        action: `Cure rate at ${latestCure.cureRate.toFixed(1)}% for ${latestCure.date}`,
        detail: `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta).toFixed(1)}pp from ${prevCure.cureRate.toFixed(1)}%. Measures % of delinquent balance recovered within 30 days of due date.`,
      });
    }
    return items;
  }, [latestDpd, prevDpd, latestCure, prevCure]);

  const trendIsLive = !isLoading && !!apiData;

  return (
    <div className="space-y-6 p-6">
      <Header title={tNav("vintageAnalysis")} />
      <p className="text-sm text-[var(--text-secondary)] -mt-4">Cohort delinquency trends, first-cycle performance, and collection cure rates</p>

      <ActiveFiltersBanner />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
          <span className="ml-3 text-sm text-[var(--text-muted)]">Loading vintage data from BigQuery...</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* HEADLINE KPIs                                                 */}
      {/* ============================================================ */}
      {trendIsLive && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {latestDpd && (
            <>
              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1">30+ DPD Rate (Vol.)</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{latestDpd.pd30.toFixed(2)}%</p>
                <p className="text-[10px] text-[var(--text-muted)]">Latest: {latestDpd.date}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1">10+ DPD Rate</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{latestDpd.pd10.toFixed(2)}%</p>
                <p className="text-[10px] text-[var(--text-muted)]">Early warning indicator</p>
              </div>
            </>
          )}
          {latestCure && (
            <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1">30-Day Cure Rate</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{latestCure.cureRate.toFixed(1)}%</p>
              <p className="text-[10px] text-[var(--text-muted)]">{latestCure.date}</p>
            </div>
          )}
          {latestDpd && (
            <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1">Observed Accounts</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{latestDpd.accounts.toLocaleString()}</p>
              <p className="text-[10px] text-[var(--text-muted)]">With observation window</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 30+ DPD BY APPLICATION MONTH                                  */}
      {/* ============================================================ */}
      {dpdAppMonthData && (
        <ChartCard
          title="30+ DPD Rate by Application Month"
          subtitle="Volume-weighted delinquency rate by decision month vintage. Excludes FT, AOF, Rp1."
          asOf={AS_OF}
          dataRange={{ start: dpdAppMonthData[0]?.date ?? "", end: dpdAppMonthData[dpdAppMonthData.length - 1]?.date ?? "" }}
          liveData={trendIsLive}
        >
          {() => (
            <DashboardLineChart
              data={dpdAppMonthData}
              lines={[
                { key: "pd30", color: "#ef4444", label: "30+ DPD %" },
                { key: "pd10", color: "#f59e0b", label: "10+ DPD %" },
                { key: "pd4", color: "#3b82f6", label: "4+ DPD %" },
              ]}
              xAxisKey="date"
              valueType="percent"
              height={300}
            />
          )}
        </ChartCard>
      )}

      {/* ============================================================ */}
      {/* 30+ DPD BY FIRST STATEMENT                                    */}
      {/* ============================================================ */}
      {dpdFirstStmtData && (
        <ChartCard
          title="30+ DPD Rate by First Statement Date"
          subtitle="Delinquency rate grouped by billing month of first statement. Count-based and volume-weighted."
          asOf={AS_OF}
          dataRange={{ start: dpdFirstStmtData[0]?.date ?? "", end: dpdFirstStmtData[dpdFirstStmtData.length - 1]?.date ?? "" }}
          liveData={trendIsLive}
        >
          {() => (
            <DashboardLineChart
              data={dpdFirstStmtData}
              lines={[
                { key: "volumeRate", color: "#ef4444", label: "Volume 30+ DPD %" },
                { key: "countRate", color: "#8b5cf6", label: "Count 30+ DPD %" },
              ]}
              xAxisKey="date"
              valueType="percent"
              height={300}
            />
          )}
        </ChartCard>
      )}

      {/* ============================================================ */}
      {/* CURE RATE TREND                                               */}
      {/* ============================================================ */}
      {cureRateData && (
        <ChartCard
          title="30-Day Cure Rate"
          subtitle="% of delinquent balance recovered within 30 days of due date. Higher is better."
          asOf={AS_OF}
          dataRange={{ start: cureRateData[0]?.date ?? "", end: cureRateData[cureRateData.length - 1]?.date ?? "" }}
          liveData={trendIsLive}
        >
          {() => (
            <DashboardLineChart
              data={cureRateData}
              lines={[{ key: "cureRate", color: "#10b981", label: "Cure Rate %" }]}
              xAxisKey="date"
              valueType="percent"
              height={300}
            />
          )}
        </ChartCard>
      )}

      {/* Action Items */}
      {actionItems.length > 0 && <ActionItems section="Vintage Analysis" items={actionItems} />}

      {/* Definitions */}
      <div className={cn("rounded-xl border p-5 text-xs", isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]")}>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Definitions</h3>
        <div className="space-y-2 text-[var(--text-muted)]">
          <p><strong className="text-[var(--text-secondary)]">30+ DPD Rate (Application Month):</strong> Volume-weighted percentage of accounts 30+ days past due on first billing cycle, grouped by the month the credit decision was made. Observation requires 30 days past first due date.</p>
          <p><strong className="text-[var(--text-secondary)]">30+ DPD Rate (First Statement):</strong> Same metric but grouped by the billing month of the first statement. Cycle day &ge;15 is shifted to the next month.</p>
          <p><strong className="text-[var(--text-secondary)]">Cure Rate:</strong> Percentage of delinquent balance (at DPD bucket 1) that is recovered within 27-30 days post-due date. Source: <code>collection_cure_rate_raw</code>.</p>
          <p><strong className="text-[var(--text-secondary)]">Exclusions:</strong> Foundational Test (FT), Account Opening Fee (AOF), and Rp1 Prepaid Card accounts are excluded from all vintage metrics.</p>
          <p><strong className="text-[var(--text-secondary)]">PD4/PD10/PD30:</strong> Past Due at 4, 10, and 30 days respectively. PD4 and PD10 serve as early warning indicators before the 30-day threshold.</p>
        </div>
      </div>
    </div>
  );
}
