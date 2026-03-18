import { NextRequest, NextResponse } from "next/server";
import {
  getCycleOverview,
  getCycleRevolveTrend,
  getCycleUtilizationDistribution,
  getCycleDpdDistribution,
  getCycleBalanceTrend,
  getCyclePaymentBehavior,
} from "@/services/queries/billing-cycle";

// ---------------------------------------------------------------------------
// GET /api/billing-cycle?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//
// Returns billing cycle analysis data from BigQuery DW004.
// startDate/endDate define the trend range; endDate is also used as the
// snapshot date for point-in-time metrics (overview, distribution, behavior).
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "2025-10-01";
    const endDate = searchParams.get("endDate") || "2026-03-17";

    const start = new Date(startDate);
    const end = new Date(endDate);

    const [
      overview,
      revolveTrend,
      utilizationDistribution,
      dpdDistribution,
      balanceTrend,
      paymentBehavior,
    ] = await Promise.all([
      getCycleOverview(end).catch(() => []),
      getCycleRevolveTrend(start, end).catch(() => []),
      getCycleUtilizationDistribution(end).catch(() => []),
      getCycleDpdDistribution(end).catch(() => []),
      getCycleBalanceTrend(start, end).catch(() => []),
      getCyclePaymentBehavior(end).catch(() => []),
    ]);

    const response = NextResponse.json({
      overview,
      revolveTrend,
      utilizationDistribution,
      dpdDistribution,
      balanceTrend,
      paymentBehavior,
      asOf: new Date().toISOString(),
      dataRange: { start: startDate, end: endDate },
    });

    response.headers.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=900, stale-while-revalidate=600",
    );
    return response;
  } catch (err) {
    console.error("[GET /api/billing-cycle]", err);
    return NextResponse.json(
      { error: "Failed to fetch billing cycle data", details: String(err) },
      { status: 500 },
    );
  }
}
