"use client";

import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 15, 2026";

const actionItems: ActionItem[] = [
  {
    id: "ref-1",
    priority: "positive",
    action: "Referral conversion rate stabilized above 51%.",
    detail: "Conversion improved from 48.2% in Oct to 51.2% in Mar. Referral quality remains strong with organic channel leading at 56% conversion.",
  },
  {
    id: "ref-2",
    priority: "monitor",
    action: "WhatsApp referrals are the second-largest channel at 25% share.",
    detail: "Conversion rate of 54.4% is close to organic. Consider increasing WhatsApp sharing incentives to grow this high-converting channel.",
  },
  {
    id: "ref-3",
    priority: "urgent",
    action: "TikTok referral conversion is lowest at 46%.",
    detail: "Despite growing volume, TikTok referrals convert poorly. Investigate whether TikTok-sourced applicants meet credit criteria or if UX friction exists in the referral link flow.",
  },
  {
    id: "ref-4",
    priority: "monitor",
    action: "December dip in referrals started (2,050) warrants seasonal planning.",
    detail: "Holiday period depressed referral activity. Pre-load January campaigns to recover momentum faster next cycle.",
  },
];

export default function ReferralPage() {
  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      <SampleDataBanner
        dataset="refined_rudderstack"
        reason="Referral data requires milestone_complete events"
      />

      <ActionItems section="Referral Program" items={actionItems} />
    </div>
  );
}
