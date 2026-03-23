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
  prevStartDate: string;
  prevEndDate: string;
} {
  const { dateParams, startDate, endDate, prevStartDate, prevEndDate } = useDateParams();
  const { filters } = useFilters();

  const apiParams = useMemo(() => {
    const filterParams = filtersToQueryParams(filters);
    const filterQs = filterParams.toString();
    const base = `${dateParams}&prevStartDate=${prevStartDate}&prevEndDate=${prevEndDate}`;
    return filterQs ? `${base}&${filterQs}` : base;
  }, [dateParams, filters, prevStartDate, prevEndDate]);

  return { apiParams, startDate, endDate, prevStartDate, prevEndDate };
}
