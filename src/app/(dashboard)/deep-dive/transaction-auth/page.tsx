"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { HorizontalBar } from "@/components/charts/horizontal-bar";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { getPeriodRange } from "@/lib/period-data";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { formatNumber } from "@/lib/utils";

const AS_OF = "Mar 15, 2026";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const actionItems: ActionItem[] = [
  {
    id: "auth-1",
    priority: "positive",
    action: "Auth approval rate reached 95.4%, highest in 6 months.",
    detail: "Steady improvement driven by better fraud rules and decline reason tuning.",
  },
  {
    id: "auth-2",
    priority: "monitor",
    action: "QRIS channel growing fastest at +27.4% over 6 months.",
    detail: "Now 16.2% of total authorizations. Monitor interchange revenue impact from lower QRIS MDR.",
  },
  {
    id: "auth-3",
    priority: "urgent",
    action: "Decline reason code breakdown unavailable.",
    detail: "Need to parse transaction_response_code details beyond 00/non-00 for decline reason analysis.",
  },
  {
    id: "auth-4",
    priority: "monitor",
    action: "Foreign transaction share stable at ~3%.",
    detail: "FX markup revenue opportunity — consider premium FX rate campaigns for travel season.",
  },
];

export default function TransactionAuthPage() {
  const { period } = usePeriod();
  const { dateParams } = useDateParams();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  // --- SWR fetch from API ---
  const { data: apiData } = useSWR(
    `/api/transaction-auth?${dateParams}`,
    fetcher,
    { fallbackData: null, revalidateOnFocus: false },
  );

  const trendIsLive = !!apiData?.weeklyAuthTrend?.length;
  const merchantsIsLive = !!apiData?.topMerchants?.length;

  // Transform weekly auth trend for charts
  const weeklyTrend = useMemo(() => {
    if (!apiData?.weeklyAuthTrend?.length) return null;
    return (apiData.weeklyAuthTrend as {
      week_start: string;
      total_auths: number;
      approved: number;
      declined: number;
      approval_rate: number;
      online_txns: number;
      qris_txns: number;
      offline_txns: number;
      avg_ticket_idr: number;
      foreign_txn_pct: number;
    }[]).map(r => ({
      date: r.week_start.replace("2025-", "").replace("2026-", "").slice(0, 5),
      totalAuths: r.total_auths,
      approved: r.approved,
      declined: r.declined,
      approvalRate: r.approval_rate,
      online: r.online_txns,
      qris: r.qris_txns,
      offline: r.offline_txns,
      avgTicket: r.avg_ticket_idr,
      foreignPct: r.foreign_txn_pct,
    }));
  }, [apiData]);

  // Latest KPI values from trend data
  const latestWeek = weeklyTrend?.[weeklyTrend.length - 1];
  const prevWeek = weeklyTrend && weeklyTrend.length >= 2 ? weeklyTrend[weeklyTrend.length - 2] : null;

  // Top merchants data
  const topMerchants = useMemo(() => {
    if (!apiData?.topMerchants?.length) return null;
    return apiData.topMerchants as {
      merchant_name: string;
      txn_count: number;
      total_spend_idr: number;
      unique_cards: number;
    }[];
  }, [apiData]);

  const maxMerchantTxn = topMerchants ? Math.max(...topMerchants.map(m => m.txn_count)) : 0;

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {weeklyTrend && latestWeek ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              metricKey="auth_approval_rate"
              label="Approval Rate"
              value={latestWeek.approvalRate}
              prevValue={prevWeek?.approvalRate ?? null}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              target={95}
              liveData={trendIsLive}
            />
            <MetricCard
              metricKey="auth_total_auths"
              label="Total Auths"
              value={latestWeek.totalAuths}
              prevValue={prevWeek?.totalAuths ?? null}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            />
            <MetricCard
              metricKey="auth_avg_ticket"
              label="Avg Ticket Size"
              value={latestWeek.avgTicket}
              prevValue={prevWeek?.avgTicket ?? null}
              unit="idr"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            />
            <MetricCard
              metricKey="auth_foreign_pct"
              label="Foreign Txn %"
              value={latestWeek.foreignPct}
              prevValue={prevWeek?.foreignPct ?? null}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            />
          </div>

          {/* Auth Approval Rate Trend */}
          <ChartCard
            title="Auth Approval Rate Trend"
            subtitle="% of authorizations approved per week (excludes PM, RF, BE)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={trendIsLive}
          >
            <DashboardLineChart
              data={weeklyTrend}
              lines={[{ key: "approvalRate", color: "#22c55e", label: "Approval Rate %" }]}
              xAxisKey="date"
              valueType="percent"
              height={300}
            />
          </ChartCard>

          {/* Total Auths Trend */}
          <ChartCard
            title="Total Auths Trend"
            subtitle="Weekly authorization volume (all statuses)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={trendIsLive}
          >
            <DashboardBarChart
              data={weeklyTrend}
              bars={[{ key: "totalAuths", color: "#3b82f6", label: "Total Auths" }]}
              xAxisKey="date"
              height={300}
            />
          </ChartCard>

          {/* Channel Mix — stacked bar */}
          <ChartCard
            title="Channel Mix"
            subtitle="Online / QRIS / Offline authorizations per week"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={trendIsLive}
          >
            <DashboardBarChart
              data={weeklyTrend}
              bars={[
                { key: "online", color: "#3b82f6", label: "Online" },
                { key: "qris", color: "#06b6d4", label: "QRIS" },
                { key: "offline", color: "#8b5cf6", label: "Offline" },
              ]}
              xAxisKey="date"
              stacked
              height={300}
            />
          </ChartCard>

          {/* Two-column: Avg Ticket Size + Foreign Txn % */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Avg Ticket Size Trend"
              subtitle="Average approved transaction amount (IDR) per week"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            >
              <DashboardLineChart
                data={weeklyTrend}
                lines={[{ key: "avgTicket", color: "#f59e0b", label: "Avg Ticket (IDR)" }]}
                xAxisKey="date"
                valueType="currency"
                height={260}
              />
            </ChartCard>

            <ChartCard
              title="Foreign Transaction %"
              subtitle="Share of non-local (RA with rte_dest != L) authorizations"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            >
              <DashboardLineChart
                data={weeklyTrend}
                lines={[{ key: "foreignPct", color: "#ef4444", label: "Foreign Txn %" }]}
                xAxisKey="date"
                valueType="percent"
                height={260}
              />
            </ChartCard>
          </div>

          {/* Top Merchants */}
          {topMerchants ? (
            <ChartCard
              title="Top Merchants"
              subtitle="Top 15 merchants by approved transaction count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={merchantsIsLive}
            >
              <div className="space-y-1">
                {topMerchants.map((m) => (
                  <HorizontalBar
                    key={m.merchant_name}
                    label={m.merchant_name || "Unknown"}
                    value={m.txn_count}
                    maxValue={maxMerchantTxn}
                    subLabel={`${formatNumber(m.unique_cards)} cards`}
                  />
                ))}
              </div>
            </ChartCard>
          ) : (
            <SampleDataBanner
              dataset="mart_finexus"
              reason="Top merchants data requires authorized_transaction (DW007)"
            />
          )}
        </>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Transaction auth data requires authorized_transaction (DW007)"
        />
      )}

      <ActionItems section="Transaction Authorization" items={actionItems} />
    </div>
  );
}
