"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { usePeriod } from "@/hooks/use-period";
import { Header } from "@/components/layout/header";
import { generateReportPdf } from "@/lib/report-pdf";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

const PAGE_LABELS: Record<string, string> = {
  "/deep-dive/acquisition": "Acquisition",
  "/deep-dive/activation": "Activation",
  "/deep-dive/referral": "Referrals",
  "/deep-dive/spend": "Spend",
  "/deep-dive/transaction-auth": "Transaction Auth",
  "/deep-dive/points-program": "Points Program",
  "/deep-dive/credit-line": "Credit Line",
  "/deep-dive/portfolio": "Portfolio",
  "/deep-dive/risk": "Risk",
  "/deep-dive/collections": "Collections",
  "/deep-dive/repayments": "Repayments",
  "/deep-dive/app-health": "App Health",
  "/deep-dive/customer-service": "Customer Service",
  "/deep-dive/users": "Users",
  "/deep-dive/cards": "Cards",
  "/deep-dive/billing-cycle": "Billing Cycle",
};

export default function DeepDiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isDark } = useTheme();
  const { period, periodLabel, dateRange, timeRange } = usePeriod();

  const sectionLabel = PAGE_LABELS[pathname] ?? "Deep Dive";
  const title = `${sectionLabel} Deep Dive`;

  // Time range label for display
  const timeRangeLabels: Record<string, string> = {
    last_full: period === "weekly" ? "Last Full Week" : period === "monthly" ? "Last Full Month" : period === "quarterly" ? "Last Full Quarter" : "Last Full Year",
    xtd: period === "weekly" ? "Week to Date" : period === "monthly" ? "Month to Date" : period === "quarterly" ? "Quarter to Date" : "Year to Date",
    full: period === "weekly" ? "Full Week" : period === "monthly" ? "Full Month" : period === "quarterly" ? "Full Quarter" : "Full Year",
  };

  const handleDownloadPdf = useCallback(() => {
    generateReportPdf({
      id: `deep-dive-${pathname.split("/").pop()}`,
      cycle: period,
      periodStart: dateRange.start.toISOString().slice(0, 10),
      periodEnd: dateRange.end.toISOString().slice(0, 10),
      section: `${sectionLabel} Deep Dive`,
      title: `${sectionLabel} Deep Dive — ${timeRangeLabels[timeRange] ?? periodLabel}`,
      generatedAt: new Date().toISOString(),
      kpis: [],
      trends: [
        `This report covers the ${timeRangeLabels[timeRange] ?? periodLabel} period.`,
        `Data range: ${dateRange.label}.`,
        "For detailed metrics and charts, refer to the webapp dashboard.",
      ],
    });
  }, [sectionLabel, pathname, period, periodLabel, dateRange, timeRange, timeRangeLabels]);

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
            title={`Save ${sectionLabel} as PDF`}
          >
            <Download className="h-3.5 w-3.5" />
            Save PDF
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
