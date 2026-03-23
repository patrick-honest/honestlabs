"use client";

import { useEffect, useState } from "react";
import { CurrencyProvider } from "@/hooks/use-currency";
import { PeriodProvider } from "@/hooks/use-period";
import { ThemeProvider } from "@/hooks/use-theme";
import { FiltersProvider } from "@/hooks/use-filters";
import { SearchStateProvider } from "@/hooks/use-search-state";
import { LanguageProvider } from "@/hooks/use-language";
import { Sidebar } from "@/components/layout/sidebar";
import { IS_STATIC_EXPORT, isStaticAuthenticated } from "@/lib/static-mode";
import enMessages from "../../../messages/en.json";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (IS_STATIC_EXPORT) {
      if (!isStaticAuthenticated()) {
        window.location.href = "/login/";
        return;
      }
      setAuthenticated(true);
    } else {
      // Server mode — assume authenticated (NextAuth handles it)
      setAuthenticated(true);
    }
    setAuthChecked(true);

    // Listen for logout events
    const handleAuthChange = () => {
      if (!isStaticAuthenticated()) {
        window.location.href = "/login/";
      }
    };
    window.addEventListener("static-auth-change", handleAuthChange);
    return () => window.removeEventListener("static-auth-change", handleAuthChange);
  }, []);

  // Don't render anything until auth is verified — prevents flash of protected content
  if (!authChecked || !authenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <LanguageProvider initialMessages={enMessages}>
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
    </LanguageProvider>
  );
}
