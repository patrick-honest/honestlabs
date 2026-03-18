"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange, getPeriodInsightLabels } from "@/lib/period-data";

const AS_OF = "Mar 15, 2026";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CollectionsPage() {
  const { period } = usePeriod();
  const { dateParams } = useDateParams();
  const { filters } = useFilters();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData } = useSWR(
    `/api/collections?${dateParams}`,
    fetcher,
    { fallbackData: null, revalidateOnFocus: false },
  );

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

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
      <ActiveFiltersBanner />

      <SampleDataBanner
        dataset="mart_collections"
        reason="Collections data requires collections_regular_activity tables"
      />

      <ActionItems section="Collections" items={actionItems} />
    </div>
  );
}
