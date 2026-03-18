"use client";

import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 15, 2026";

const actionItems: ActionItem[] = [
  {
    id: "auth-1",
    priority: "positive",
    action: "Auth approval rate reached 95.4%, highest in 6 months.",
    detail: "Steady improvement driven by better fraud rules and decline reason tuning.",
  },
  {
    id: "auth-2",
    priority: "monitor",
    action: "QRIS channel growing fastest at +27.4% over 6 months.",
    detail: "Now 16.2% of total authorizations. Monitor interchange revenue impact from lower QRIS MDR.",
  },
  {
    id: "auth-3",
    priority: "urgent",
    action: "Decline reason code breakdown unavailable.",
    detail: "Need to parse transaction_response_code details beyond 00/non-00 for decline reason analysis.",
  },
  {
    id: "auth-4",
    priority: "monitor",
    action: "Foreign transaction share stable at ~3%.",
    detail: "FX markup revenue opportunity — consider premium FX rate campaigns for travel season.",
  },
];

export default function TransactionAuthPage() {
  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      <SampleDataBanner
        dataset="mart_finexus"
        reason="Transaction auth data requires authorized_transaction (DW007)"
      />

      <ActionItems section="Transaction Authorization" items={actionItems} />
    </div>
  );
}
