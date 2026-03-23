/**
 * Client-side time series re-aggregation by increment (daily/weekly/monthly).
 *
 * The API returns data at weekly granularity. This utility re-buckets it
 * for display at different time increments selected by the user.
 *
 * - "daily": pass-through (data is already at finest granularity available)
 * - "weekly": pass-through (matches API default)
 * - "monthly": aggregate weekly rows into monthly buckets
 */

import type { ChartIncrement } from "@/components/dashboard/chart-card";

/**
 * Aggregate an array of data points by the selected time increment.
 *
 * @param data - Array of objects with a date/time key
 * @param increment - "daily" | "weekly" | "monthly"
 * @param dateKey - The key containing the date string (default: "date")
 * @param sumKeys - Keys to SUM when aggregating (default: all numeric keys except rates)
 * @param avgKeys - Keys to AVERAGE when aggregating (rates, percentages)
 */
export function aggregateByIncrement<T extends Record<string, unknown>>(
  data: T[],
  increment: ChartIncrement,
  dateKey = "date",
  avgKeys: string[] = [],
): T[] {
  if (!data || data.length === 0) return data;

  // Daily and weekly are pass-through (API already returns weekly)
  if (increment === "daily" || increment === "weekly") return data;

  // Monthly: bucket by YYYY-MM
  const buckets = new Map<string, T[]>();

  for (const row of data) {
    const dateVal = String(row[dateKey] ?? "");
    const monthKey = dateVal.slice(0, 7); // "YYYY-MM"
    if (!monthKey) continue;
    if (!buckets.has(monthKey)) buckets.set(monthKey, []);
    buckets.get(monthKey)!.push(row);
  }

  // Build aggregated rows
  const result: T[] = [];
  for (const [month, rows] of buckets) {
    const aggregated: Record<string, unknown> = { [dateKey]: month };

    // Get all numeric keys from the first row
    const firstRow = rows[0];
    for (const key of Object.keys(firstRow)) {
      if (key === dateKey) continue;
      const val = firstRow[key];
      if (typeof val !== "number") {
        aggregated[key] = val; // Keep non-numeric as-is (use first row's value)
        continue;
      }

      const isAvg = avgKeys.includes(key) ||
        key.toLowerCase().includes("rate") ||
        key.toLowerCase().includes("pct") ||
        key.toLowerCase().includes("percent") ||
        key.toLowerCase().includes("avg");

      if (isAvg) {
        // Average
        const sum = rows.reduce((s, r) => s + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);
        aggregated[key] = Math.round((sum / rows.length) * 100) / 100;
      } else {
        // Sum
        aggregated[key] = rows.reduce((s, r) => s + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);
      }
    }

    result.push(aggregated as T);
  }

  return result;
}
