"use client";

import { Header } from "@/components/layout/header";
import { useTranslations } from "next-intl";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "2026-03-17";

const actionItems: ActionItem[] = [
  {
    id: "cq-1",
    priority: "urgent",
    action: "Investigate TikTok channel delinquency — 8.5% DPD 30+ rate.",
    detail: "Nearly 2x organic. Review audience targeting and risk policy for this cohort.",
  },
  {
    id: "cq-2",
    priority: "positive",
    action: "Scale referral channel — best quality score.",
    detail: "72% approval, 3.1% DPD but only 5% of volume. Evaluate incentive increase.",
  },
  {
    id: "cq-3",
    priority: "monitor",
    action: "Add UTM medium/campaign breakdowns.",
    detail: "Current view is source-level only. Campaign-level data would enable spend optimization.",
  },
  {
    id: "cq-4",
    priority: "urgent",
    action: "Set up Meta channel risk guardrails — 7.1% DPD rate.",
    detail: "Exceeds 6% threshold. Consider tighter pre-qualification or reduced bid caps.",
  },
];

export default function ChannelQualityPage() {
  const tNav = useTranslations("nav");

  return (
    <div className="flex flex-col">
      <Header title={tNav("channelQuality")} />

      <div className="flex-1 space-y-6 p-6">
        <ActiveFiltersBanner />

        <SampleDataBanner
          dataset="refined_rudderstack + mart_finexus"
          reason="Channel quality data requires decision_completed and financial_account_updates (DW004)"
        />

        <ActionItems section="Channel Quality" items={actionItems} />
      </div>
    </div>
  );
}
