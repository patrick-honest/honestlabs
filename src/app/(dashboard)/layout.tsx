"use client";

import { CurrencyProvider } from "@/hooks/use-currency";
import { PeriodProvider } from "@/hooks/use-period";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CurrencyProvider>
      <PeriodProvider>
        <div className="flex h-screen overflow-hidden bg-slate-950">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </PeriodProvider>
    </CurrencyProvider>
  );
}
