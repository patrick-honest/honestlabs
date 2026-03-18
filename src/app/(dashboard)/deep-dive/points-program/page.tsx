"use client";

import { useMemo, useCallback } from "react";
import useSWR from "swr";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { getPeriodRange } from "@/lib/period-data";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 15, 2026";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const actionItems: ActionItem[] = [
  {
    id: "pts-1",
    priority: "urgent",
    action: "High point liability (~842M outstanding) -- monitor for balance sheet impact.",
    detail:
      "Total closing points balance has been steadily growing. Work with finance to ensure adequate provisioning and consider whether redemption incentives should be increased to manage liability.",
  },
  {
    id: "pts-2",
    priority: "positive",
    action: "Redemption rate healthy at ~82% -- good engagement signal.",
    detail:
      "Customers are actively redeeming points, indicating the rewards catalog is attractive. Maintain current redemption options and monitor for any drop-off.",
  },
  {
    id: "pts-3",
    priority: "monitor",
    action: "Batch expiry of 61M points in March -- check customer communication.",
    detail:
      "A large batch of points expired this month, significantly above the ~2M monthly average. Verify that affected customers received advance notification and consider a grace period policy for future batch expiries.",
  },
  {
    id: "pts-4",
    priority: "monitor",
    action: "70% of accounts have 0 points -- dormant user engagement opportunity.",
    detail:
      "The majority of accounts carry no points balance. This segment likely includes inactive cardholders. Cross-reference with activation data to identify re-engagement campaigns targeting dormant users.",
  },
];

export default function PointsProgramPage() {
  const { period } = usePeriod();
  const { filters } = useFilters();
  const { dateParams } = useDateParams();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData } = useSWR(
    `/api/points-program?${dateParams}`,
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
        reason="Points data requires points/rewards tables in Finexus DW"
      />

      <ActionItems section="Points Program" items={actionItems} />
    </div>
  );
}
