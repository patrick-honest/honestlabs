import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    if (value >= 1_000_000_000) {
      const v = value / 1_000_000_000;
      return `${Number(v.toFixed(2))}B`;
    }
    if (value >= 1_000_000) {
      const v = value / 1_000_000;
      return `${Number(v.toFixed(2))}M`;
    }
    if (value >= 1_000) {
      const v = value / 1_000;
      return `${Number(v.toFixed(2))}K`;
    }
  }
  // Cap at 2 decimal places
  const rounded = Math.round(value * 100) / 100;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(rounded);
}

export function formatPercent(value: number): string {
  // Cap at 2 decimal places, strip trailing zeros
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}%`;
}

export function formatCurrency(value: number, currency: "IDR" | "USD"): string {
  if (currency === "USD") {
    return `$${formatNumber(value / 16_000, { compact: true })}`;
  }
  return `Rp ${formatNumber(value, { compact: true })}`;
}
