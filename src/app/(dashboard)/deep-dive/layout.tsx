"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { usePeriod } from "@/hooks/use-period";
import { Header } from "@/components/layout/header";
import { generateReportPdf } from "@/lib/report-pdf";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useTranslations } from "next-intl";

// Maps pathname to the nav translation key for each deep-dive page
const PAGE_NAV_KEYS: Record<string, string> = {
  "/deep-dive/acquisition": "acquisition",
  "/deep-dive/activation": "activation",
  "/deep-dive/referral": "referrals",
  "/deep-dive/spend": "spend",
  "/deep-dive/transaction-auth": "txnAuth",
  "/deep-dive/points-program": "points",
  "/deep-dive/credit-line": "creditLine",
  "/deep-dive/portfolio": "portfolio",
  "/deep-dive/risk": "risk",
  "/deep-dive/collections": "collections",
  "/deep-dive/repayments": "repayments",
  "/deep-dive/app-health": "appHealth",
  "/deep-dive/customer-service": "customerService",
  "/deep-dive/users": "users",
  "/deep-dive/cards": "cards",
  "/deep-dive/billing-cycle": "billingCycle",
};

export default function DeepDiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isDark } = useTheme();
  const { period, periodLabel, dateRange, timeRange } = usePeriod();
  const tNav = useTranslations("nav");
  const tTime = useTranslations("time");
  const tCommon = useTranslations("common");

  const navKey = PAGE_NAV_KEYS[pathname];
  const sectionLabel = navKey ? tNav(navKey) : tNav("deepDive");
  const title = `${sectionLabel} ${tNav("deepDive")}`;

  // Time range label for display — now translated
  const timeRangeLabels: Record<string, string> = {
    last_full: period === "weekly" ? tTime("lastFullWeek") : period === "monthly" ? tTime("lastFullMonth") : period === "quarterly" ? tTime("lastFullQuarter") : periodLabel,
    xtd: period === "weekly" ? tTime("weekToDate") : period === "monthly" ? tTime("monthToDate") : period === "quarterly" ? tTime("quarterToDate") : tTime("yearToDate"),
    full: period === "weekly" ? tTime("weekly") : period === "monthly" ? tTime("monthly") : period === "quarterly" ? tTime("quarterly") : tTime("yearly"),
  };

  const handleDownloadPdf = useCallback(() => {
    generateReportPdf({
      id: `deep-dive-${pathname.split("/").pop()}`,
      cycle: period,
      periodStart: dateRange.start.toISOString().slice(0, 10),
      periodEnd: dateRange.end.toISOString().slice(0, 10),
      section: `${sectionLabel} ${tNav("deepDive")}`,
      title: `${sectionLabel} ${tNav("deepDive")} — ${timeRangeLabels[timeRange] ?? periodLabel}`,
      generatedAt: new Date().toISOString(),
      kpis: [],
      trends: [
        `This report covers the ${timeRangeLabels[timeRange] ?? periodLabel} period.`,
        `Data range: ${dateRange.label}.`,
        "For detailed metrics and charts, refer to the webapp dashboard.",
      ],
    });
  }, [sectionLabel, tNav, pathname, period, periodLabel, dateRange, timeRange, timeRangeLabels]);

  return (
    <div className="flex flex-col h-full">
      <Header title={title} />

      {/* Page content with inline title + save PDF */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Title row with Save PDF button */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{title}</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {timeRangeLabels[timeRange] ?? periodLabel} · {dateRange.label}
            </p>
          </div>
          <button
            onClick={handleDownloadPdf}
            className={cn(
              "flex items-center gap-1.5 shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              isDark
                ? "text-[#7C4DFF] hover:bg-[#5B22FF]/15 border border-[#5B22FF]/30"
                : "text-[#D00083] hover:bg-[#D00083]/10 border border-[#D00083]/30"
            )}
            title={`${tCommon("savePdf")} — ${sectionLabel}`}
          >
            <Download className="h-3.5 w-3.5" />
            {tCommon("savePdf")}
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
