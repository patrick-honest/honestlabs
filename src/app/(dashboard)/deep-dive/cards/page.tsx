"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { useTheme } from "@/hooks/use-theme";
import { getPeriodRange } from "@/lib/period-data";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------------------------------------------------------------------------
// Mock fallback data
// ---------------------------------------------------------------------------

const MOCK_CARD_STATUS = [
  { card_status: "Active", accounts: 271000 },
  { card_status: "WR", accounts: 73000 },
  { card_status: "CC", accounts: 28000 },
  { card_status: "OR", accounts: 28000 },
  { card_status: "VE", accounts: 3200 },
];

const MOCK_BRAND_SPLIT = [
  { brand: "MC", accounts: 304000 },
  { brand: "VS", accounts: 101000 },
];

const MOCK_CARD_PROGRAMS = [
  { card_pgm: "PGM-001", brand: "MC", accounts: 180000 },
  { card_pgm: "PGM-002", brand: "MC", accounts: 78000 },
  { card_pgm: "PGM-003", brand: "VS", accounts: 62000 },
  { card_pgm: "PGM-004", brand: "MC", accounts: 46000 },
  { card_pgm: "PGM-005", brand: "VS", accounts: 39000 },
];

const MOCK_PRODUCT_TYPE = [
  { product_type: "RP1", users: 297000 },
  { product_type: "Regular", users: 119000 },
  { product_type: "AOF", users: 61000 },
  { product_type: "Salvage", users: 38000 },
];

const MOCK_VERIFICATION = [
  { reason: "DECISION_TO_SKIP", users: 188000 },
  { reason: "VIDEO_VERIFIED", users: 145000 },
];

const MOCK_AUTO_ACTIVATION = 360000;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CardsOverviewPage() {
  const { period, dateRange } = usePeriod();
  const { dateParams } = useDateParams();
  const { isDark } = useTheme();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData } = useSWR(
    `/api/cards-overview?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  // -----------------------------------------------------------------------
  // Resolve live vs mock data
  // -----------------------------------------------------------------------

  const cardStatusData = useMemo(() => {
    if (!apiData?.cardStatusDistribution?.length) return MOCK_CARD_STATUS;
    // Aggregate across brands for the status chart
    const map = new Map<string, number>();
    for (const row of apiData.cardStatusDistribution) {
      const status = row.card_status ?? "Active";
      map.set(status, (map.get(status) ?? 0) + Number(row.accounts));
    }
    return Array.from(map.entries())
      .map(([card_status, accounts]) => ({ card_status, accounts }))
      .sort((a, b) => b.accounts - a.accounts);
  }, [apiData]);

  const brandSplitData = useMemo(() => {
    if (!apiData?.cardBrandSplit?.length) return MOCK_BRAND_SPLIT;
    return apiData.cardBrandSplit.map((r: { brand: string; accounts: number }) => ({
      brand: r.brand,
      accounts: Number(r.accounts),
    }));
  }, [apiData]);

  const cardProgramData = useMemo(() => {
    if (!apiData?.cardProgramDistribution?.length) return MOCK_CARD_PROGRAMS;
    return apiData.cardProgramDistribution
      .slice(0, 10)
      .map((r: { card_pgm: string; brand: string; accounts: number }) => ({
        card_pgm: r.card_pgm,
        brand: r.brand,
        accounts: Number(r.accounts),
      }));
  }, [apiData]);

  const productTypeData = useMemo(() => {
    if (!apiData?.productTypeSplit?.length) return MOCK_PRODUCT_TYPE;
    return apiData.productTypeSplit.map((r: { product_type: string; users: number }) => ({
      product_type: r.product_type,
      users: Number(r.users),
    }));
  }, [apiData]);

  const verificationData = useMemo(() => {
    if (!apiData?.verificationSplit?.length) return MOCK_VERIFICATION;
    return apiData.verificationSplit.map((r: { reason: string; users: number }) => ({
      reason: r.reason === "VIDEO_VERIFIED" ? "Video Verified" : r.reason === "DECISION_TO_SKIP" ? "Decision to Skip" : r.reason,
      users: Number(r.users),
    }));
  }, [apiData]);

  const autoActivationCount = useMemo(() => {
    if (apiData?.autoActivationCount != null) return Number(apiData.autoActivationCount);
    return MOCK_AUTO_ACTIVATION;
  }, [apiData]);

  // -----------------------------------------------------------------------
  // KPI values
  // -----------------------------------------------------------------------

  const totalCards = useMemo(() => {
    return brandSplitData.reduce((s: number, r: { accounts: number }) => s + r.accounts, 0);
  }, [brandSplitData]);

  const mcCards = useMemo(() => {
    const mc = brandSplitData.find((r: { brand: string }) => r.brand === "MC");
    return mc ? mc.accounts : 0;
  }, [brandSplitData]);

  const vsCards = useMemo(() => {
    const vs = brandSplitData.find((r: { brand: string }) => r.brand === "VS");
    return vs ? vs.accounts : 0;
  }, [brandSplitData]);

  const asOf = apiData?.asOf
    ? new Date(apiData.asOf).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Mar 17, 2026";

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="cards_total"
          label="Total Cards"
          value={totalCards}
          unit="count"
          asOf={asOf}
          dataRange={DATA_RANGE}
        />
        <MetricCard
          metricKey="cards_mc"
          label="Mastercard"
          value={mcCards}
          unit="count"
          asOf={asOf}
          dataRange={DATA_RANGE}
        />
        <MetricCard
          metricKey="cards_vs"
          label="Visa"
          value={vsCards}
          unit="count"
          asOf={asOf}
          dataRange={DATA_RANGE}
        />
        <MetricCard
          metricKey="cards_auto_activated"
          label="Auto-Activated"
          value={autoActivationCount}
          unit="count"
          asOf={asOf}
          dataRange={DATA_RANGE}
        />
      </div>

      {/* Card Status Distribution */}
      <ChartCard
        title="Card Status Distribution"
        subtitle="Account count by card status code (latest DW005 snapshot)"
        asOf={asOf}
        dataRange={DATA_RANGE}
      >
        <DashboardBarChart
          data={cardStatusData}
          bars={[{ key: "accounts", color: isDark ? "#5B22FF" : "#D00083", label: "Accounts" }]}
          xAxisKey="card_status"
          height={300}
        />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card Brand Split */}
        <ChartCard
          title="Card Brand Split"
          subtitle="Mastercard vs Visa account distribution"
          asOf={asOf}
          dataRange={DATA_RANGE}
        >
          <DashboardBarChart
            data={brandSplitData}
            bars={[{ key: "accounts", color: isDark ? "#06D6A0" : "#059669", label: "Accounts" }]}
            xAxisKey="brand"
            height={280}
          />
        </ChartCard>

        {/* Card Program Distribution */}
        <ChartCard
          title="Card Program Distribution"
          subtitle="Top card programs by account count"
          asOf={asOf}
          dataRange={DATA_RANGE}
        >
          <DashboardBarChart
            data={cardProgramData}
            bars={[{ key: "accounts", color: isDark ? "#7C4DFF" : "#9333EA", label: "Accounts" }]}
            xAxisKey="card_pgm"
            height={280}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Product Type Split */}
        <ChartCard
          title="Product Type Split"
          subtitle="Approved applicants by product category"
          asOf={asOf}
          dataRange={DATA_RANGE}
        >
          <DashboardBarChart
            data={productTypeData}
            bars={[{ key: "users", color: isDark ? "#FFD166" : "#F5A623", label: "Users" }]}
            xAxisKey="product_type"
            height={280}
          />
        </ChartCard>

        {/* Verification Method */}
        <ChartCard
          title="Verification Method Split"
          subtitle="Video Verified vs Decision to Skip"
          asOf={asOf}
          dataRange={DATA_RANGE}
        >
          <DashboardBarChart
            data={verificationData}
            bars={[{ key: "users", color: isDark ? "#FF6B6B" : "#DC2626", label: "Users" }]}
            xAxisKey="reason"
            height={280}
          />
        </ChartCard>
      </div>
    </div>
  );
}
