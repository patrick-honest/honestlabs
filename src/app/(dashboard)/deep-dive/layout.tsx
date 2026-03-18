"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

const tabs = [
  { label: "Acquisition", href: "/deep-dive/acquisition" },
  { label: "Portfolio", href: "/deep-dive/portfolio" },
  { label: "Spend", href: "/deep-dive/spend" },
  { label: "Risk", href: "/deep-dive/risk" },
  { label: "Activation", href: "/deep-dive/activation" },
  { label: "Collections", href: "/deep-dive/collections" },
  { label: "Repayments", href: "/deep-dive/repayments" },
  { label: "Customer Service", href: "/deep-dive/customer-service" },
  { label: "Txn Auth", href: "/deep-dive/transaction-auth" },
  { label: "App Health", href: "/deep-dive/app-health" },
  { label: "Referrals", href: "/deep-dive/referral" },
  { label: "Credit Line", href: "/deep-dive/credit-line" },
];

export default function DeepDiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isDark } = useTheme();

  return (
    <div className="flex flex-col h-full">
      {/* Tab navigation */}
      <nav className={cn(
        "sticky top-0 z-20 border-b backdrop-blur-sm px-6",
        isDark
          ? "border-[var(--border)] bg-[var(--background)]/80"
          : "border-[var(--border)] bg-[var(--background)]/90"
      )}>
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? isDark
                      ? "border-[#5B22FF] text-[var(--text-primary)]"
                      : "border-[#D00083] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border)]"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
