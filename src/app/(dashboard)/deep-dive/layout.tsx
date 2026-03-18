"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { Header } from "@/components/layout/header";

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

  // Derive title from active tab
  const activeTab = tabs.find((t) => pathname === t.href);
  const title = activeTab ? `${activeTab.label} Deep Dive` : "Deep Dive";

  return (
    <div className="flex flex-col h-full">
      {/* Header with filters, period, time range */}
      <Header title={title} />

      {/* Tab navigation */}
      <nav className={cn(
        "sticky top-[41px] z-20 border-b backdrop-blur-sm px-6",
        isDark
          ? "border-[var(--border)] bg-[var(--background)]/80"
          : "border-[var(--border)] bg-[var(--background)]/90"
      )}>
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
          {tabs.map((tab, idx) => {
            const isActive = pathname === tab.href;
            return (
              <div key={tab.href} className="flex items-center shrink-0">
                {/* Group divider */}
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
      </nav>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
