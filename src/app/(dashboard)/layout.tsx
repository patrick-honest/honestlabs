"use client";

import { CurrencyProvider } from "@/hooks/use-currency";
import { PeriodProvider } from "@/hooks/use-period";
import { ThemeProvider } from "@/hooks/use-theme";
import { FiltersProvider } from "@/hooks/use-filters";
import { SearchStateProvider } from "@/hooks/use-search-state";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <CurrencyProvider>
        <PeriodProvider>
          <FiltersProvider>
            <SearchStateProvider>
              <div className="flex h-screen overflow-hidden bg-[var(--background)] transition-colors">
                <Sidebar />
                <main className="relative z-10 flex-1 overflow-y-auto">{children}</main>
              </div>
            </SearchStateProvider>
          </FiltersProvider>
        </PeriodProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
}
