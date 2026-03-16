export const IDR_USD_RATE = 16_000;

export function idrToUsd(idr: number): number {
  return idr / IDR_USD_RATE;
}

export function usdToIdr(usd: number): number {
  return usd * IDR_USD_RATE;
}

export function formatAmount(amountIdr: number, currency: "IDR" | "USD"): string {
  if (currency === "USD") {
    const usd = idrToUsd(amountIdr);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(usd);
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountIdr);
}

export function formatAmountCompact(amountIdr: number, currency: "IDR" | "USD"): string {
  const value = currency === "USD" ? idrToUsd(amountIdr) : amountIdr;
  const prefix = currency === "USD" ? "$" : "Rp ";

  if (Math.abs(value) >= 1_000_000_000_000) return `${prefix}${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `${prefix}${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
  return `${prefix}${value.toFixed(currency === "USD" ? 2 : 0)}`;
}
