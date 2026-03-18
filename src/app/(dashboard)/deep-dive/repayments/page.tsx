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

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const AS_OF = "Mar 15, 2026";

// ---------------------------------------------------------------------------
// Action items
// ---------------------------------------------------------------------------

const actionItems: ActionItem[] = [
  {
    id: "repay-1",
    priority: "positive",
    action: "On-time payments improved to 77.5%, highest in 6 months.",
    detail: "Pre-due-date SMS reminders appear effective. Payment-to-bill ratio also up to 78.4%. Continue current reminder cadence.",
  },
  {
    id: "repay-2",
    priority: "monitor",
    action: "Auto-debit penetration remains low at 11%.",
    detail: "Increasing auto-debit enrollment would reduce late payments and lower payment processing costs. Consider incentives (e.g., cashback on first auto-debit).",
  },
  {
    id: "repay-3",
    priority: "urgent",
    action: "61-90 DPD bucket has only 14.7% avg payment rate.",
    detail: "These 3,210 accounts are at high risk of write-off. Prioritize restructuring or settlement offers before they roll past 90 days.",
  },
  {
    id: "repay-4",
    priority: "monitor",
    action: "Zero-payment accounts still at 4.9% (approx 3,700 accounts).",
    detail: "Despite improvement from 6.3%, these accounts need proactive outreach. Cross-reference with collections team contact status.",
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function RepaymentsPage() {
  const { period } = usePeriod();
  const { dateParams } = useDateParams();
  const { filters } = useFilters();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData } = useSWR(
    `/api/repayments?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  // --- Weekly repayment trend (from DW009) ---
  const weeklyTrend = useMemo(() => {
    if (!apiData?.weeklyTrend?.length) return null;
    return (apiData.weeklyTrend as {
      week_start: string;
      payment_count: number;
      total_amount_idr: number;
      unique_accounts: number;
    }[]).map((r) => ({
      date: r.week_start.slice(5, 10), // "MM-DD"
      paymentCount: r.payment_count,
      totalAmountIdr: r.total_amount_idr,
      uniqueAccounts: r.unique_accounts,
    }));
  }, [apiData]);

  const weeklyIsLive = !!weeklyTrend?.length;
  const latestWeek = weeklyTrend?.[weeklyTrend.length - 1] ?? null;
  const prevWeek = weeklyTrend && weeklyTrend.length >= 2 ? weeklyTrend[weeklyTrend.length - 2] : null;

  // --- Monthly volume trend ---
  const volumeTrend = useMemo(() => {
    if (!apiData?.volumeTrend?.length) return null;
    return (apiData.volumeTrend as {
      month: string;
      count: number;
      total_amount_idr: number;
    }[]).map((r) => ({
      date: r.month,
      count: r.count,
      totalAmountIdr: r.total_amount_idr,
    }));
  }, [apiData]);

  const volumeIsLive = !!volumeTrend?.length;

  // --- By vendor ---
  const vendorData = useMemo(() => {
    if (!apiData?.byVendor?.length) return null;
    return (apiData.byVendor as {
      vendor: string;
      count: number;
      amount: number;
    }[]).map((r) => ({
      label: r.vendor,
      count: r.count,
      amount: r.amount,
    }));
  }, [apiData]);

  const vendorIsLive = !!vendorData?.length;

  // --- Timeliness ---
  const timelinessData = useMemo(() => {
    if (!apiData?.timeliness?.length) return null;
    return (apiData.timeliness as {
      bucket: string;
      accounts: number;
      pct: number;
    }[]).map((r) => ({
      label: r.bucket,
      accounts: r.accounts,
      pct: r.pct,
    }));
  }, [apiData]);

  const timelinessIsLive = !!timelinessData?.length;

  // --- Balance ratio ---
  const ratioData = useMemo(() => {
    if (!apiData?.balanceRatio?.length) return null;
    return (apiData.balanceRatio as {
      month: string;
      avg_ratio: number;
    }[]).map((r) => ({
      date: r.month,
      avgRatio: r.avg_ratio,
    }));
  }, [apiData]);

  const ratioIsLive = !!ratioData?.length;

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI Row from weekly trend */}
      {weeklyTrend && latestWeek ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              metricKey="repayments_payment_count"
              label="Weekly Payments"
              value={latestWeek.paymentCount}
              prevValue={prevWeek?.paymentCount ?? null}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={weeklyIsLive}
            />
            <MetricCard
              metricKey="repayments_total_amount"
              label="Weekly Amount"
              value={latestWeek.totalAmountIdr}
              prevValue={prevWeek?.totalAmountIdr ?? null}
              unit="idr"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={weeklyIsLive}
            />
            <MetricCard
              metricKey="repayments_unique_accounts"
              label="Unique Accounts"
              value={latestWeek.uniqueAccounts}
              prevValue={prevWeek?.uniqueAccounts ?? null}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={weeklyIsLive}
            />
            <MetricCard
              metricKey="repayments_avg_payment"
              label="Avg Payment"
              value={Math.round(latestWeek.totalAmountIdr / (latestWeek.paymentCount || 1))}
              prevValue={prevWeek ? Math.round(prevWeek.totalAmountIdr / (prevWeek.paymentCount || 1)) : null}
              unit="idr"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={weeklyIsLive}
            />
          </div>

          {/* Weekly Payment Count Trend */}
          <ChartCard
            title="Weekly Repayment Trend"
            subtitle="Payment count and unique accounts per ISO week (PM + RF transactions)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={weeklyIsLive}
          >
            <DashboardLineChart
              data={weeklyTrend}
              lines={[
                { key: "paymentCount", color: "#3b82f6", label: "Payment Count" },
                { key: "uniqueAccounts", color: "#22c55e", label: "Unique Accounts" },
              ]}
              xAxisKey="date"
              height={300}
            />
          </ChartCard>

          {/* Weekly Amount Trend */}
          <ChartCard
            title="Weekly Repayment Amount"
            subtitle="Total repayment amount (IDR) per ISO week"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={weeklyIsLive}
          >
            <DashboardBarChart
              data={weeklyTrend}
              bars={[{ key: "totalAmountIdr", color: "#8b5cf6", label: "Amount (IDR)" }]}
              xAxisKey="date"
              height={300}
            />
          </ChartCard>
        </>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Weekly repayment trend requires posted_transaction (DW009)"
        />
      )}

      {/* Monthly Volume Trend */}
      {volumeTrend ? (
        <ChartCard
          title="Monthly Repayment Volume"
          subtitle="Payment count by month (PM transactions)"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          liveData={volumeIsLive}
        >
          <DashboardBarChart
            data={volumeTrend}
            bars={[{ key: "count", color: "#06b6d4", label: "Payments" }]}
            xAxisKey="date"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Monthly volume trend requires posted_transaction (DW009)"
        />
      )}

      {/* Repayment by Vendor */}
      {vendorData ? (
        <ChartCard
          title="Repayment by Vendor"
          subtitle="Payment count by vendor channel"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          liveData={vendorIsLive}
        >
          <DashboardBarChart
            data={vendorData}
            bars={[{ key: "count", color: "#f59e0b", label: "Payments" }]}
            xAxisKey="label"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="refined_rudderstack"
          reason="Vendor breakdown requires repayment_completed events"
        />
      )}

      {/* Timeliness Distribution */}
      {timelinessData ? (
        <ChartCard
          title="Payment Timeliness"
          subtitle="Account distribution by DPD bucket at latest date"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          liveData={timelinessIsLive}
        >
          <DashboardBarChart
            data={timelinessData}
            bars={[{ key: "accounts", color: "#10b981", label: "Accounts" }]}
            xAxisKey="label"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Timeliness data requires financial_account_updates (DW004)"
        />
      )}

      {/* Payment-to-Balance Ratio */}
      {ratioData ? (
        <ChartCard
          title="Payment-to-Balance Ratio"
          subtitle="Average monthly repayment as % of outstanding balance"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          liveData={ratioIsLive}
        >
          <DashboardLineChart
            data={ratioData}
            lines={[{ key: "avgRatio", color: "#ec4899", label: "Avg Ratio %" }]}
            xAxisKey="date"
            valueType="percent"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Balance ratio requires posted_transaction (DW009) + financial_account_updates (DW004)"
        />
      )}

      <ActionItems section="Repayments" items={actionItems} />
    </div>
  );
}
