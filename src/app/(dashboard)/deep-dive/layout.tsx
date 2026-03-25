"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { usePeriod } from "@/hooks/use-period";
import { Header } from "@/components/layout/header";
import { PdfDownloadModal } from "@/components/dashboard/pdf-download-modal";
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

// Maps pathname segments to PDF report IDs
const PAGE_REPORT_IDS: Record<string, string> = {
  "acquisition": "acquisition",
  "activation": "activation",
  "referral": "referral",
  "spend": "spend-analysis",
  "transaction-auth": "transaction-auth",
  "points-program": "points-program",
  "credit-line": "credit-line",
  "portfolio": "portfolio",
  "risk": "risk",
  "collections": "collections",
  "repayments": "repayments",
  "app-health": "app-health",
  "customer-service": "customer-service",
  "users": "users-overview",
  "cards": "cards-overview",
  "billing-cycle": "billing-cycle",
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

  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Strip basePath prefix and trailing slash so the key always matches
  const normalizedPath = pathname.replace(/\/$/, "").replace(/^\/honestlabs/, "");
  const navKey = PAGE_NAV_KEYS[normalizedPath];
  const sectionLabel = navKey ? tNav(navKey) : "";
  const title = sectionLabel ? `${sectionLabel} ${tNav("deepDive")}` : tNav("deepDive");

  // Determine the report ID from the last path segment
  const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
  const reportId = PAGE_REPORT_IDS[lastSegment] ?? `deep-dive-${lastSegment}`;

  // Time range label for display — now translated
  const timeRangeLabels: Record<string, string> = {
    last_full: period === "weekly" ? tTime("lastFullWeek") : period === "monthly" ? tTime("lastFullMonth") : period === "quarterly" ? tTime("lastFullQuarter") : periodLabel,
    xtd: period === "weekly" ? tTime("weekToDate") : period === "monthly" ? tTime("monthToDate") : period === "quarterly" ? tTime("quarterToDate") : tTime("yearToDate"),
    full: period === "weekly" ? tTime("weekly") : period === "monthly" ? tTime("monthly") : period === "quarterly" ? tTime("quarterly") : tTime("yearly"),
  };

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
            onClick={() => setPdfModalOpen(true)}
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

      {/* PDF Download Modal */}
      <PdfDownloadModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        reportId={reportId}
        reportTitle={title}
        defaultStartDate={dateRange.start.toISOString().slice(0, 10)}
        defaultEndDate={dateRange.end.toISOString().slice(0, 10)}
        defaultPeriod={period}
      />
    </div>
  );
}
