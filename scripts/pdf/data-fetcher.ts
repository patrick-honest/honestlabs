// ---------------------------------------------------------------------------
// Data Fetcher — retrieves API data for PDF generation
// ---------------------------------------------------------------------------

const API_BASE = process.env.API_BASE_URL || "http://localhost:3099";

// ---------------------------------------------------------------------------
// Date range computation
// ---------------------------------------------------------------------------

/** Get last full week (Monday-Sunday before today) */
export function getLastFullWeek(
  refDate?: Date,
): { start: string; end: string } {
  const d = refDate ?? new Date();
  // Find last Sunday
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ...
  const lastSunday = new Date(d);
  lastSunday.setDate(d.getDate() - (dayOfWeek === 0 ? 7 : dayOfWeek));
  // Monday of that week
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);
  return {
    start: toISODate(lastMonday),
    end: toISODate(lastSunday),
  };
}

/** Get the week before the last full week */
export function getPreviousWeek(
  refDate?: Date,
): { start: string; end: string } {
  const lastWeek = getLastFullWeek(refDate);
  const end = new Date(lastWeek.start);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return {
    start: toISODate(start),
    end: toISODate(end),
  };
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Response cache
// ---------------------------------------------------------------------------
const cache = new Map<string, unknown>();

function cacheKey(endpoint: string, start: string, end: string): string {
  return `${endpoint}::${start}::${end}`;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------
export async function fetchReportData(
  endpoint: string,
  startDate: string,
  endDate: string,
  period: string = "weekly",
): Promise<Record<string, unknown>> {
  const key = cacheKey(endpoint, startDate, endDate);
  if (cache.has(key)) {
    return cache.get(key) as Record<string, unknown>;
  }

  const url = new URL(endpoint, API_BASE);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  url.searchParams.set("period", period);

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `API ${endpoint} returned ${resp.status}: ${text.slice(0, 200)}`,
    );
  }

  const data = (await resp.json()) as Record<string, unknown>;
  cache.set(key, data);
  return data;
}

/**
 * Fetch data for a report: current period + previous period (for overlays).
 * Returns { current, previous }.
 */
export async function fetchWithPrevPeriod(
  endpoint: string,
  current: { start: string; end: string },
  previous: { start: string; end: string },
  period: string = "weekly",
): Promise<{
  current: Record<string, unknown>;
  previous: Record<string, unknown>;
}> {
  const [currentData, previousData] = await Promise.all([
    fetchReportData(endpoint, current.start, current.end, period),
    fetchReportData(endpoint, previous.start, previous.end, period).catch(
      () => ({} as Record<string, unknown>),
    ),
  ]);

  return { current: currentData, previous: previousData };
}

/**
 * Fetch all reports in parallel.
 */
export async function fetchAllReports(
  endpoints: string[],
  current: { start: string; end: string },
  previous: { start: string; end: string },
  period: string = "weekly",
): Promise<
  Map<
    string,
    { current: Record<string, unknown>; previous: Record<string, unknown> }
  >
> {
  const results = new Map<
    string,
    { current: Record<string, unknown>; previous: Record<string, unknown> }
  >();

  const tasks = endpoints.map(async (ep) => {
    try {
      const data = await fetchWithPrevPeriod(ep, current, previous, period);
      results.set(ep, data);
    } catch (err) {
      console.error(`Failed to fetch ${ep}:`, err);
      results.set(ep, {
        current: {},
        previous: {},
      });
    }
  });

  await Promise.all(tasks);
  return results;
}

/** Clear cache between runs */
export function clearCache(): void {
  cache.clear();
}
