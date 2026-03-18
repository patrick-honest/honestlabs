"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { getPeriodRange } from "@/lib/period-data";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { ChartCard } from "@/components/dashboard/chart-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const AS_OF = "Mar 19, 2026";

const actionItems: ActionItem[] = [
  {
    id: "cards-1",
    priority: "positive",
    action: "Mastercard dominates card program distribution.",
    detail: "Review if Visa co-brand partnerships could diversify the portfolio and reduce network concentration risk.",
  },
  {
    id: "cards-2",
    priority: "monitor",
    action: "Verification rate to be monitored.",
    detail: "Track the ratio of video-verified vs not-verified accounts to ensure compliance targets are met.",
  },
  {
    id: "cards-3",
    priority: "urgent",
    action: "Inactive/blocked card statuses need follow-up.",
    detail: "Accounts with non-active statuses may represent churn risk or operational issues. Investigate root causes.",
  },
];

export default function CardsOverviewPage() {
  const { period } = usePeriod();
  const { dateParams } = useDateParams();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData } = useSWR(
    `/api/cards-overview?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  // ── Derived data ──

  const cardStatusData = useMemo(() => {
    if (!apiData?.cardStatusBreakdown) return null;
    return apiData.cardStatusBreakdown as { status: string; accounts: number }[];
  }, [apiData]);

  const cardProgramData = useMemo(() => {
    if (!apiData?.cardProgramBreakdown) return null;
    return apiData.cardProgramBreakdown as { card_pgm: string; brand: string; accounts: number }[];
  }, [apiData]);

  const verificationData = useMemo(() => {
    if (!apiData?.verificationBreakdown) return null;
    return apiData.verificationBreakdown as { verification: string; accounts: number }[];
  }, [apiData]);

  // Brand split from card program data
  const brandSplit = useMemo(() => {
    if (!cardProgramData) return null;
    const totals: Record<string, number> = {};
    for (const row of cardProgramData) {
      totals[row.brand] = (totals[row.brand] || 0) + row.accounts;
    }
    return Object.entries(totals).map(([brand, accounts]) => ({ brand, accounts }));
  }, [cardProgramData]);

  const totalCards = useMemo(() => {
    if (!cardStatusData) return 0;
    return cardStatusData.reduce((sum, r) => sum + r.accounts, 0);
  }, [cardStatusData]);

  const brandTotal = useMemo(() => {
    if (!brandSplit) return 0;
    return brandSplit.reduce((sum, r) => sum + r.accounts, 0);
  }, [brandSplit]);

  const mcPct = useMemo(() => {
    if (!brandSplit || brandTotal === 0) return 0;
    const mc = brandSplit.find((b) => b.brand === "Mastercard");
    return mc ? Math.round((mc.accounts / brandTotal) * 10000) / 100 : 0;
  }, [brandSplit, brandTotal]);

  const visaPct = useMemo(() => {
    if (!brandSplit || brandTotal === 0) return 0;
    const visa = brandSplit.find((b) => b.brand === "Visa");
    return visa ? Math.round((visa.accounts / brandTotal) * 10000) / 100 : 0;
  }, [brandSplit, brandTotal]);

  const isLive = !!apiData?.cardStatusBreakdown;

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI Metric Cards */}
      {isLive ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            metricKey="total-cards"
            label="Total Cards"
            value={totalCards}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="mc-pct"
            label="Mastercard %"
            value={mcPct}
            unit="percent"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="visa-pct"
            label="Visa %"
            value={visaPct}
            unit="percent"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
        </div>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Card KPIs require principal_card_updates (DW005)"
        />
      )}

      {/* Card Status Distribution */}
      {cardStatusData ? (
        <ChartCard
          title="Card Status Distribution"
          subtitle="Unique accounts by card status code"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
          liveData
        >
          <DashboardBarChart
            data={cardStatusData}
            bars={[{ key: "accounts", color: "#8b5cf6", label: "Accounts" }]}
            xAxisKey="status"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Card status distribution requires principal_card_updates (DW005)"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card Brand Split */}
        {brandSplit ? (
          <ChartCard
            title="Card Brand Split"
            subtitle="Mastercard vs Visa account distribution"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
            liveData
          >
            <DashboardBarChart
              data={brandSplit}
              bars={[{ key: "accounts", color: "#22c55e", label: "Accounts" }]}
              xAxisKey="brand"
              height={280}
            />
          </ChartCard>
        ) : (
          <SampleDataBanner
            dataset="mart_finexus"
            reason="Brand split requires principal_card_updates (DW005)"
          />
        )}

        {/* Verification Breakdown */}
        {verificationData ? (
          <ChartCard
            title="Verification Breakdown"
            subtitle="Video Verified vs Not Verified accounts"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
            liveData
          >
            <DashboardBarChart
              data={verificationData}
              bars={[{ key: "accounts", color: "#f59e0b", label: "Accounts" }]}
              xAxisKey="verification"
              height={280}
            />
          </ChartCard>
        ) : (
          <SampleDataBanner
            dataset="mart_finexus"
            reason="Verification breakdown requires principal_card_updates (DW005)"
          />
        )}
      </div>

      {/* Card Program Distribution */}
      {cardProgramData ? (
        <ChartCard
          title="Card Program Distribution"
          subtitle="Account distribution by card program code and brand"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
          liveData
        >
          <DashboardBarChart
            data={cardProgramData}
            bars={[{ key: "accounts", color: "#3b82f6", label: "Accounts" }]}
            xAxisKey="card_pgm"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Card program distribution requires principal_card_updates (DW005)"
        />
      )}

      <ActionItems section="Cards" items={actionItems} />
    </div>
  );
}
