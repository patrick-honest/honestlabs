"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange } from "@/lib/period-data";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const AS_OF = "Mar 15, 2026";

// ---------------------------------------------------------------------------
// Action items
// ---------------------------------------------------------------------------

const actionItems: ActionItem[] = [
  {
    id: "repay-1",
    priority: "positive",
    action: "On-time payments improved to 77.5%, highest in 6 months.",
    detail: "Pre-due-date SMS reminders appear effective. Payment-to-bill ratio also up to 78.4%. Continue current reminder cadence.",
  },
  {
    id: "repay-2",
    priority: "monitor",
    action: "Auto-debit penetration remains low at 11%.",
    detail: "Increasing auto-debit enrollment would reduce late payments and lower payment processing costs. Consider incentives (e.g., cashback on first auto-debit).",
  },
  {
    id: "repay-3",
    priority: "urgent",
    action: "61-90 DPD bucket has only 14.7% avg payment rate.",
    detail: "These 3,210 accounts are at high risk of write-off. Prioritize restructuring or settlement offers before they roll past 90 days.",
  },
  {
    id: "repay-4",
    priority: "monitor",
    action: "Zero-payment accounts still at 4.9% (approx 3,700 accounts).",
    detail: "Despite improvement from 6.3%, these accounts need proactive outreach. Cross-reference with collections team contact status.",
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function RepaymentsPage() {
  const { period } = usePeriod();
  const { dateParams } = useDateParams();
  const { filters } = useFilters();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData } = useSWR(
    `/api/repayments?${dateParams}`,
    fetcher,
    { fallbackData: null, revalidateOnFocus: false },
  );

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      <SampleDataBanner
        dataset="mart_finexus"
        reason="Repayment data requires posted_transaction (DW009) and financial_account_updates (DW004)"
      />

      <ActionItems section="Repayments" items={actionItems} />
    </div>
  );
}
