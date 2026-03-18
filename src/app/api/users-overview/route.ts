import { NextRequest, NextResponse } from "next/server";
import {
  getAccountStatusDistribution,
  getDeviceBreakdown,
  getDemographics,
  getVerificationBreakdown,
  getGeographicDistribution,
} from "@/services/queries/users-overview";

// ---------------------------------------------------------------------------
// GET /api/users-overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//
// Returns real BigQuery users overview data — account statuses, devices,
// demographics, verification breakdown, and geographic distribution.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "2025-01-01";
    const endDate = searchParams.get("endDate") || "2026-03-16";

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Run all queries in parallel
    const [
      accountStatuses,
      devices,
      demographics,
      verification,
      geographic,
    ] = await Promise.all([
      getAccountStatusDistribution().catch(() => []),
      getDeviceBreakdown(start, end).catch(() => []),
      getDemographics(start, end).catch(() => []),
      getVerificationBreakdown(start, end).catch(() => []),
      getGeographicDistribution(start, end).catch(() => []),
    ]);

    const response = NextResponse.json({
      accountStatuses,
      devices,
      demographics,
      verification,
      geographic,
      asOf: new Date().toISOString(),
      dataRange: { start: startDate, end: endDate },
    });

    response.headers.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=900, stale-while-revalidate=600",
    );
    return response;
  } catch (err) {
    console.error("[GET /api/users-overview]", err);
    return NextResponse.json(
      { error: "Failed to fetch users overview data", details: String(err) },
      { status: 500 },
    );
  }
}
