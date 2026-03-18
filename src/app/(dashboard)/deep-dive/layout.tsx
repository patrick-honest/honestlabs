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
};

export default function DeepDiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isDark } = useTheme();
  const { period, periodLabel, dateRange } = usePeriod();

  const sectionLabel = PAGE_LABELS[pathname] ?? "Deep Dive";
  const title = `${sectionLabel} Deep Dive`;

  const handleDownloadPdf = useCallback(() => {
    generateReportPdf({
      id: `deep-dive-${pathname.split("/").pop()}`,
      cycle: period,
      periodStart: dateRange.start.toISOString().slice(0, 10),
      periodEnd: dateRange.end.toISOString().slice(0, 10),
      section: `${sectionLabel} Deep Dive`,
      title: `${sectionLabel} Deep Dive — ${periodLabel}`,
      generatedAt: new Date().toISOString(),
      kpis: [],
      trends: [
        `This report covers the ${periodLabel} period.`,
        `Data range: ${dateRange.label}.`,
        "For detailed metrics, refer to the webapp dashboard.",
      ],
    });
  }, [sectionLabel, pathname, period, periodLabel, dateRange]);

  return (
    <div className="flex flex-col h-full">
      <Header title={title} />

      {/* Save PDF bar — slim, below header */}
      <div className={cn(
        "flex items-center justify-end px-6 py-1 border-b",
        isDark ? "border-[var(--border)] bg-[var(--background)]" : "border-[var(--border)] bg-[var(--background)]"
      )}>
        <button
          onClick={handleDownloadPdf}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
            isDark
              ? "text-[#7C4DFF] hover:bg-[#5B22FF]/15"
              : "text-[#D00083] hover:bg-[#D00083]/10"
          )}
          title={`Save ${sectionLabel} as PDF`}
        >
          <Download className="h-3 w-3" />
          Save PDF
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
