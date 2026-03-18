"use client";

import { useMemo } from "react";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod } from "@/hooks/use-period";
import { useTranslations } from "next-intl";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 15, 2026";

const actionItems: ActionItem[] = [
  {
    id: "vin-1",
    priority: "positive",
    action: "Jan 2026 cohort showing best early performance.",
    detail: "MOB 1 delinquency at 0.8% vs 1.2% for Jul 2025 cohort. Scorecard improvements in Q4 appear effective.",
  },
  {
    id: "vin-2",
    priority: "monitor",
    action: "Sep 2025 cohort has highest delinquency curve.",
    detail: "4.8% at MOB 6, above the 4.5% average. Monitor for early write-off signals.",
  },
  {
    id: "vin-3",
    priority: "positive",
    action: "Activation curves improving for recent cohorts.",
    detail: "Feb 2026 cohort at 65.2% MOB 1 activation, best ever. Onboarding improvements paying off.",
  },
];

export default function VintagePage() {
  const { periodLabel } = usePeriod();
  const tNav = useTranslations("nav");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{tNav("vintageAnalysis")}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{periodLabel}</p>
      </div>

      <ActiveFiltersBanner />

      <SampleDataBanner
        dataset="mart_finexus"
        reason="Vintage analysis requires financial_account_updates (DW004) and authorized_transaction (DW007) for cohort tracking"
      />

      <ActionItems section="Vintage Analysis" items={actionItems} />
    </div>
  );
}
