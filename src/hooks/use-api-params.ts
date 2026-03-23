"use client";

import { useMemo } from "react";
import { useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { filtersToQueryParams } from "@/lib/filter-utils";

/**
 * Combined date + filter params for API calls.
 * When filters change, the query string changes → SWR refetches with server-side filtering.
 *
 * Usage:
 *   const { apiParams } = useApiParams();
 *   useSWR(`/api/spend-analysis?${apiParams}`, fetcher);
 */
export function useApiParams(): {
  apiParams: string;
  startDate: string;
  endDate: string;
} {
  const { dateParams, startDate, endDate } = useDateParams();
  const { filters } = useFilters();

  const apiParams = useMemo(() => {
    const filterParams = filtersToQueryParams(filters);
    const filterQs = filterParams.toString();
    return filterQs ? `${dateParams}&${filterQs}` : dateParams;
  }, [dateParams, filters]);

  return { apiParams, startDate, endDate };
}
