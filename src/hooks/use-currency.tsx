"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Currency } from "@/types/reports";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toggleCurrency: () => void;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

function getStoredCurrency(): Currency {
  if (typeof window === "undefined") return "IDR";
  try {
    const stored = localStorage.getItem("honest-currency");
    if (stored === "IDR" || stored === "USD") return stored;
  } catch { /* SSR or localStorage blocked */ }
  return "USD";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD");

  // Hydrate from localStorage on mount
  useEffect(() => {
    setCurrencyState(getStoredCurrency());
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem("honest-currency", c); } catch { /* noop */ }
  }, []);

  const toggleCurrency = useCallback(() => {
    setCurrencyState((prev) => {
      const next = prev === "IDR" ? "USD" : "IDR";
      try { localStorage.setItem("honest-currency", next); } catch { /* noop */ }
      return next as Currency;
    });
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, toggleCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
