"use client";

import { useMemo } from "react";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod } from "@/hooks/use-period";
import { getPeriodInsightLabels } from "@/lib/period-data";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 15, 2026";

export default function CustomerServicePage() {
  const { period } = usePeriod();
  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const actionItems: ActionItem[] = useMemo(() => [
    {
      id: "cs-1",
      priority: "positive",
      action: "Avg first response time improved to 8.5 minutes.",
      detail: `Down from 12.5 min in ${p.firstLabel}. Resolution time also improved to 3.5 hours. Bot handling nearly 50% of volume.`,
    },
    {
      id: "cs-2",
      priority: "monitor",
      action: "Card activation issues are top contact reason.",
      detail: "520 tickets this period. Investigate if activation UX changes can reduce inbound volume.",
    },
    {
      id: "cs-3",
      priority: "monitor",
      action: "Transaction disputes at 480 tickets.",
      detail: "Second highest contact reason. Review dispute patterns for potential fraud signals or merchant issues.",
    },
    {
      id: "cs-4",
      priority: "positive",
      action: "Bot resolution now handling 50% of volume.",
      detail: `Up from 39% in ${p.firstLabel}. Continue investing in bot capabilities to further reduce human agent load.`,
    },
  ], [p]);

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      <SampleDataBanner
        dataset="mart_freshworks"
        reason="Customer service data requires freshdesk_ticket_summary and freshchat_interaction_summary"
      />

      <ActionItems section="Customer Service" items={actionItems} />
    </div>
  );
}
