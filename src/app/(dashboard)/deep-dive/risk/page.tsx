"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange } from "@/lib/period-data";

const AS_OF = "Mar 15, 2026";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const actionItems: ActionItem[] = [
  {
    id: "risk-1",
    priority: "positive",
    action: "30+ DPD rate declining to 4.7%.",
    detail: "Down from 5.2% peak in Dec. Collections effectiveness improving with cure rate at 62.9%.",
  },
  {
    id: "risk-2",
    priority: "urgent",
    action: "90+ DPD accounts still growing at 0.7%.",
    detail: "Flow rate from 61-90 to 90+ needs attention. Consider accelerated recovery strategies for this bucket.",
  },
  {
    id: "risk-3",
    priority: "monitor",
    action: "Write-off amounts plateauing near Rp 1B/month.",
    detail: "Monitor vintage performance to identify if specific cohorts are driving losses disproportionately.",
  },
];

export default function RiskPage() {
  const { period } = usePeriod();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const { dateParams } = useDateParams();

  const { data: apiData } = useSWR(
    `/api/risk?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      <SampleDataBanner
        dataset="mart_finexus"
        reason="Risk data requires financial_account_updates (DW004)"
      />

      <ActionItems section="Risk" items={actionItems} />
    </div>
  );
}
