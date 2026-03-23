"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { ChartSkeleton, MetricCardsSkeleton } from "@/components/dashboard/chart-skeleton";
import { usePeriod } from "@/hooks/use-period";
import { useApiParams } from "@/hooks/use-api-params";
import { useFilters } from "@/hooks/use-filters";
import { useCurrency } from "@/hooks/use-currency";
import { formatAmountCompact } from "@/lib/currency";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange, getPeriodInsightLabels } from "@/lib/period-data";
import { useTranslations } from "next-intl";
import { PrintStyles } from "@/components/layout/print-styles";

const AS_OF = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CollectionsPage() {
  const { period } = usePeriod();
  const { apiParams } = useApiParams();
  const { filters } = useFilters();
  const { currency } = useCurrency();
  const t = useTranslations("collections");

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData, isLoading } = useSWR(
    `/api/collections?${apiParams}`,
    fetcher,
    { fallbackData: null, revalidateOnFocus: false },
  );

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  // --- Cure Rate Trend ---
  const cureRateTrend = useMemo(() => {
    if (!apiData?.cureRateTrend?.length) return null;
    return (apiData.cureRateTrend as {
      month: string;
      cure_rate_pct: number;
      cured_balance: number;
      total_balance: number;
    }[]).map((r) => ({
      date: r.month,
      cureRate: r.cure_rate_pct,
      curedBalance: r.cured_balance,
      totalBalance: r.total_balance,
    }));
  }, [apiData]);

  const cureRateIsLive = !!cureRateTrend?.length;
  const latestCure = cureRateTrend?.[cureRateTrend.length - 1] ?? null;
  const prevCure = cureRateTrend && cureRateTrend.length >= 2 ? cureRateTrend[cureRateTrend.length - 2] : null;

  const fmtCur = useCallback((v: number) => formatAmountCompact(v, currency), [currency]);

  const actionItems: ActionItem[] = useMemo(() => [
    {
      id: "coll-1",
      priority: "positive" as const,
      action: `Cure rate improved to 62.9%, highest in ${p.span}.`,
      detail: `Contact rate also trending up to 87.1%. Recovery amounts growing ${p.changeAbbrev}.`,
    },
    {
      id: "coll-2",
      priority: "monitor" as const,
      action: "Promise-to-pay conversion still below 55%.",
      detail: "Consider revising scripts or offering structured payment plans for higher PTP conversion.",
    },
    {
      id: "coll-3",
      priority: "urgent" as const,
      action: "Agent D and E cure rates below 60%.",
      detail: "Performance gap vs top agents suggests coaching opportunity. Review call recordings and approach.",
    },
  ], [p]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <PrintStyles />
      <ActiveFiltersBanner />

      <SampleDataBanner
        dataset="mart_collections"
        reason="Collections data requires collections_regular_activity tables"
      />

      {/* ================================================================== */}
      {/* Cure Rate Section                                                  */}
      {/* ================================================================== */}
      <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <span className="i-lucide-heart-pulse w-5 h-5" aria-hidden="true" />
        {t("cureRate")}
      </h2>

      {cureRateTrend && latestCure ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              metricKey="collections_cure_rate"
              label={t("cureRate")}
              value={latestCure.cureRate}
              prevValue={prevCure?.cureRate ?? null}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={cureRateIsLive}
            />
            <MetricCard
              metricKey="collections_cured_balance"
              label={t("curedBalance")}
              value={latestCure.curedBalance}
              prevValue={prevCure?.curedBalance ?? null}
              unit="idr"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={cureRateIsLive}
            />
            <MetricCard
              metricKey="collections_total_balance"
              label={t("totalBalance")}
              value={latestCure.totalBalance}
              prevValue={prevCure?.totalBalance ?? null}
              unit="idr"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={cureRateIsLive}
            />
          </div>

          {/* Cure Rate Trend Chart */}
          <ChartCard
            title={t("cureRateTrend")}
            subtitle="Monthly cure rate for DPD BI 1 accounts (non-FT)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={cureRateIsLive}
          >
            <DashboardLineChart
              data={cureRateTrend}
              lines={[{ key: "cureRate", color: "#22c55e", label: "Cure Rate %" }]}
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
          reason="Cure rate data requires collection_cure_rate_raw table"
        />
      )}

      <ActionItems section="Collections" items={actionItems} />
    </div>
  );
}
