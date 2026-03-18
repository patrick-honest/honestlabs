"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { getPeriodRange } from "@/lib/period-data";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      <SampleDataBanner
        dataset="mart_finexus"
        reason="Cards data requires principal_card_updates (DW005)"
      />
    </div>
  );
}
