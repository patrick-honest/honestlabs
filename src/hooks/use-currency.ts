"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Currency } from "@/types/reports";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toggleCurrency: () => void;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("IDR");

  const toggleCurrency = useCallback(() => {
    setCurrency((prev) => (prev === "IDR" ? "USD" : "IDR"));
  }, []);

  return (
    <CurrencyContext value={{ currency, setCurrency, toggleCurrency }}>
      {children}
    </CurrencyContext>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
