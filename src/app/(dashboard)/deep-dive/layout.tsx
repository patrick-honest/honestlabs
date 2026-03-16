"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Acquisition", href: "/deep-dive/acquisition" },
  { label: "Portfolio", href: "/deep-dive/portfolio" },
  { label: "Spend", href: "/deep-dive/spend" },
  { label: "Risk", href: "/deep-dive/risk" },
  { label: "Activation", href: "/deep-dive/activation" },
  { label: "Collections", href: "/deep-dive/collections" },
  { label: "Customer Service", href: "/deep-dive/customer-service" },
];

export default function DeepDiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Tab navigation */}
      <nav className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm px-6">
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
                    ? "border-blue-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600"
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
