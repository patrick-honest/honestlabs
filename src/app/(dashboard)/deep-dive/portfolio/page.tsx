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
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const { dateParams } = useDateParams();

  const { data: apiData } = useSWR(
    `/api/portfolio?${dateParams}`,
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
        reason="Portfolio data requires financial_account_updates (DW004) and new_card_application (DW001)"
      />

      <ActionItems section="Portfolio" items={actionItems} />
    </div>
  );
}
