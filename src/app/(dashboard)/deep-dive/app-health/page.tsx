"use client";

import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 15, 2026";

const actionItems: ActionItem[] = [
  {
    id: "app-1",
    priority: "positive",
    action: "DAU/MAU ratio at 15.9%, indicating healthy daily engagement.",
    detail: "Industry benchmark for fintech apps in SEA is 12-18%. Honest is in the upper range.",
  },
  {
    id: "app-2",
    priority: "positive",
    action: "Error rate dropped to 1.1%, lowest in 6 months.",
    detail: "Continuous improvement in app stability. Target: below 1.0% by Q2 2026.",
  },
  {
    id: "app-3",
    priority: "monitor",
    action: "Savings account feature adoption at 18.5% — underperforming.",
    detail: "Consider in-app prompts or incentives to drive savings feature discovery.",
  },
  {
    id: "app-4",
    priority: "monitor",
    action: "Tap to Pay adoption at 12.3% — growth opportunity.",
    detail: "HCE/NFC support needs wider device compatibility and user education campaigns.",
  },
];

export default function AppHealthPage() {
  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      <SampleDataBanner
        dataset="Mixpanel / Google Analytics"
        reason="App health data requires external analytics integration (Mixpanel or GA)"
      />

      <ActionItems section="App Health" items={actionItems} />
    </div>
  );
}
