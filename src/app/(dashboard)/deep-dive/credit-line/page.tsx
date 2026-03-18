"use client";

import { useCallback, useMemo } from "react";
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
    id: "cli-1",
    priority: "positive",
    action: "CLI volume averaging 8,500/month with 6,200 unique recipients.",
    detail: "Healthy repeat CLI rate (~27% of CLIs go to users who received prior increases) indicates the scoring engine is progressively rewarding good behavior.",
  },
  {
    id: "cli-2",
    priority: "positive",
    action: "Automatic CLIs account for 60% of volume.",
    detail: "High automation rate reduces operational burden. Avg increase for auto CLIs (IDR 2.1M) is appropriately conservative versus manual (IDR 3.2M).",
  },
  {
    id: "cli-3",
    priority: "monitor",
    action: "Avg increase of IDR 2.5M is at the upper end of risk appetite.",
    detail: "Monitor delinquency rates for accounts that received CLIs in the past 90 days. If Bucket 1 entry rate exceeds 5%, consider tightening thresholds.",
  },
  {
    id: "cli-4",
    priority: "urgent",
    action: "Promotional CLIs (15%) need ROI validation.",
    detail: "Promotional increases average IDR 2.8M but lack spend-lift tracking. Implement a control group to measure incremental revenue from promotional CLI campaigns.",
  },
];

export default function CreditLinePage() {
  const { period } = usePeriod();
  const { filters } = useFilters();
  const { dateParams } = useDateParams();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData } = useSWR(
    `/api/credit-line?${dateParams}`,
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
        reason="Credit line data requires financial_account_updates (DW004)"
      />

      <ActionItems section="Credit Line Increases" items={actionItems} />
    </div>
  );
}
