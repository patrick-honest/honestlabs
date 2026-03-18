"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { usePeriod } from "@/hooks/use-period";
import { Header } from "@/components/layout/header";
import { generateReportPdf } from "@/lib/report-pdf";
import { Download } from "lucide-react";

interface Tab { label: string; href: string; group?: string }

const tabs: Tab[] = [
  // Growth
  { label: "Acquisition", href: "/deep-dive/acquisition", group: "Growth" },
  { label: "Activation", href: "/deep-dive/activation" },
  { label: "Referrals", href: "/deep-dive/referral" },
  // Revenue
  { label: "Spend", href: "/deep-dive/spend", group: "Revenue" },
  { label: "Txn Auth", href: "/deep-dive/transaction-auth" },
  { label: "Points", href: "/deep-dive/points-program" },
  { label: "Credit Line", href: "/deep-dive/credit-line" },
  // Risk & Collections
  { label: "Portfolio", href: "/deep-dive/portfolio", group: "Risk" },
  { label: "Risk", href: "/deep-dive/risk" },
  { label: "Collections", href: "/deep-dive/collections" },
  { label: "Repayments", href: "/deep-dive/repayments" },
  // Operations
  { label: "App Health", href: "/deep-dive/app-health", group: "Ops" },
  { label: "Customer Service", href: "/deep-dive/customer-service" },
];

export default function DeepDiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isDark } = useTheme();
  const { period, periodLabel, dateRange } = usePeriod();

  const activeTab = tabs.find((t) => pathname === t.href);
  const title = activeTab ? `${activeTab.label} Deep Dive` : "Deep Dive";

  const handleDownloadPdf = useCallback(() => {
    const section = activeTab?.label ?? "Deep Dive";
    generateReportPdf({
      id: `deep-dive-${pathname.split("/").pop()}`,
      cycle: period,
      periodStart: dateRange.start.toISOString().slice(0, 10),
      periodEnd: dateRange.end.toISOString().slice(0, 10),
      section: `${section} Deep Dive`,
      title: `${section} Deep Dive — ${periodLabel}`,
      generatedAt: new Date().toISOString(),
      kpis: [],
      trends: [
        `This report covers the ${periodLabel} period.`,
        `Data range: ${dateRange.label}.`,
        "For detailed metrics, refer to the webapp dashboard.",
      ],
    });
  }, [activeTab, pathname, period, periodLabel, dateRange]);

  return (
    <div className="flex flex-col h-full">
      <Header title={title} />

      {/* Tab navigation + Save PDF button */}
      <nav className={cn(
        "sticky top-[41px] z-20 border-b backdrop-blur-sm px-6",
        isDark
          ? "border-[var(--border)] bg-[var(--background)]/80"
          : "border-[var(--border)] bg-[var(--background)]/90"
      )}>
        <div className="flex items-center">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none flex-1">
            {tabs.map((tab, idx) => {
              const isActive = pathname === tab.href;
              return (
                <div key={tab.href} className="flex items-center shrink-0">
                  {tab.group && idx > 0 && (
                    <div className="mx-1 h-4 w-px bg-[var(--border)]" />
                  )}
                  {tab.group && (
                    <span className={cn(
                      "text-[8px] font-bold uppercase tracking-[0.15em] px-1.5 shrink-0",
                      isDark ? "text-[var(--text-muted)]/40" : "text-[var(--text-muted)]/50"
                    )}>
                      {tab.group}
                    </span>
                  )}
                  <Link
                    href={tab.href}
                    className={cn(
                      "shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors",
                      isActive
                        ? isDark
                          ? "border-[#5B22FF] text-[var(--text-primary)]"
                          : "border-[#D00083] text-[var(--text-primary)]"
                        : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border)]"
                    )}
                  >
                    {tab.label}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Save PDF button — always visible */}
          <button
            onClick={handleDownloadPdf}
            className={cn(
              "flex items-center gap-1.5 shrink-0 ml-2 rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-colors",
              isDark
                ? "text-[#7C4DFF] hover:bg-[#5B22FF]/15"
                : "text-[#D00083] hover:bg-[#D00083]/10"
            )}
            title={`Save ${activeTab?.label ?? "Deep Dive"} as PDF`}
          >
            <Download className="h-3 w-3" />
            Save PDF
          </button>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
