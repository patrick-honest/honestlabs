"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { getPeriodRange } from "@/lib/period-data";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const AS_OF = "Mar 17, 2026";

export default function UsersDeepDivePage() {
  const { period } = usePeriod();
  const { dateParams } = useDateParams();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData } = useSWR(
    `/api/users-overview?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      <SampleDataBanner
        dataset="refined_rudderstack + mart_finexus"
        reason="User data requires refined_rudderstack.users and financial_account_updates (DW004)"
      />
    </div>
  );
}
