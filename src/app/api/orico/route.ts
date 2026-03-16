import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import {
  getApprovedBySegment,
  getAcceptedCumulative,
  getActivePortfolio,
  getPortfolioSummary,
  getProvision,
  getRp1Topup,
  getOnboardingFunnel,
} from "@/services/queries/orico";

// ---------------------------------------------------------------------------
// GET /api/orico?refresh=true
//
// Returns all Orico partner report data. Results are cached in SQLite for 24h.
// Pass ?refresh=true to bust the cache and re-query BigQuery.
// ---------------------------------------------------------------------------

const CACHE_KEY = "orico:all";
const TTL_HOURS = 24;

interface OricoPayload {
  data: {
    approvedBySegment: unknown[];
    acceptedCumulative: unknown[];
    activePortfolio: unknown[];
    portfolioSummary: unknown[];
    provision: unknown[];
    rp1Topup: unknown[];
    onboardingFunnel: unknown[];
    bookedCustomerKpis: unknown[];
    portfolioBalances: unknown[];
    monthlySpending: unknown[];
    flowRates: unknown[];
    revolvingRate: unknown[];
  };
  errors: string[];
  updatedAt: string;
  isLive: boolean;
}

// Map query names to their functions and result keys
const QUERY_MAP = {
  approvedBySegment: () => getApprovedBySegment(),
  acceptedCumulative: () => getAcceptedCumulative(),
  activePortfolio: () => getActivePortfolio(),
  portfolioSummary: () => getPortfolioSummary(),
  provision: () => {
    // Provision requires a report date — use yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = yesterday.toISOString().split("T")[0];
    return getProvision(reportDate);
  },
  rp1Topup: () => getRp1Topup(),
  onboardingFunnel: () => getOnboardingFunnel(),
} as const;

// Keys that don't have query functions yet — included so the response shape
// stays consistent for frontend consumers.
const PLACEHOLDER_KEYS = [
  "bookedCustomerKpis",
  "portfolioBalances",
  "monthlySpending",
  "flowRates",
  "revolvingRate",
] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    // ── Try cache first ──────────────────────────────────────────────────
    if (!forceRefresh) {
      const cached = getCached<OricoPayload>(CACHE_KEY);
      if (cached) {
        const response = NextResponse.json({
          ...cached.data,
          updatedAt: cached.updatedAt,
        });
        response.headers.set(
          "Cache-Control",
          "public, max-age=300, s-maxage=900, stale-while-revalidate=600",
        );
        return response;
      }
    }

    // ── Run all queries in parallel ──────────────────────────────────────
    const queryNames = Object.keys(QUERY_MAP) as (keyof typeof QUERY_MAP)[];
    const results = await Promise.allSettled(
      queryNames.map((name) => QUERY_MAP[name]()),
    );

    const data: Record<string, unknown[]> = {};
    const errors: string[] = [];

    results.forEach((result, idx) => {
      const name = queryNames[idx];
      if (result.status === "fulfilled") {
        data[name] = result.value;
      } else {
        console.error(`[GET /api/orico] Query "${name}" failed:`, result.reason);
        errors.push(`${name}: ${String(result.reason)}`);
        data[name] = [];
      }
    });

    // Add placeholder keys with empty arrays
    for (const key of PLACEHOLDER_KEYS) {
      data[key] = [];
    }

    const updatedAt = new Date().toISOString();

    const payload: OricoPayload = {
      data: data as OricoPayload["data"],
      errors,
      updatedAt,
      isLive: true,
    };

    // ── Store in cache ───────────────────────────────────────────────────
    setCached(CACHE_KEY, payload, TTL_HOURS);

    const response = NextResponse.json(payload);
    response.headers.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=900, stale-while-revalidate=600",
    );
    return response;
  } catch (err) {
    console.error("[GET /api/orico]", err);
    return NextResponse.json(
      { error: "Failed to fetch Orico data", details: String(err) },
      { status: 500 },
    );
  }
}
