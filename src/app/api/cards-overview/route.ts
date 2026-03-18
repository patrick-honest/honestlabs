import { NextRequest, NextResponse } from "next/server";
import {
  getCardStatusDistribution,
  getCardBrandSplit,
  getCardProgramDistribution,
  getAutoActivationCount,
  getVerificationSplit,
  getProductTypeSplit,
} from "@/services/queries/cards-overview";
import {
  getCardStatusBreakdown,
  getCardProgramBreakdown,
  getVerificationBreakdown,
} from "@/services/queries/cards-deep-dive";

// ---------------------------------------------------------------------------
// GET /api/cards-overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//
// Runs all cards-overview queries in parallel and returns combined result.
// startDate/endDate are used for date-ranged queries (verification, product type).
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "2025-01-01";
    const endDate = searchParams.get("endDate") || "2026-03-17";

    const [
      cardStatusDistribution,
      cardBrandSplit,
      cardProgramDistribution,
      autoActivationCount,
      verificationSplit,
      productTypeSplit,
      // Deep-dive queries
      cardStatusBreakdown,
      cardProgramBreakdown,
      verificationBreakdown,
    ] = await Promise.all([
      getCardStatusDistribution(),
      getCardBrandSplit(),
      getCardProgramDistribution(),
      getAutoActivationCount(),
      getVerificationSplit(new Date(startDate), new Date(endDate)),
      getProductTypeSplit(new Date(startDate), new Date(endDate)),
      // Deep-dive queries
      getCardStatusBreakdown(),
      getCardProgramBreakdown(),
      getVerificationBreakdown(),
    ]);

    const response = NextResponse.json({
      cardStatusDistribution,
      cardBrandSplit,
      cardProgramDistribution,
      autoActivationCount,
      verificationSplit,
      productTypeSplit,
      // Deep-dive data
      cardStatusBreakdown,
      cardProgramBreakdown,
      verificationBreakdown,
      asOf: new Date().toISOString(),
      dataRange: { start: startDate, end: endDate },
    });

    response.headers.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=900, stale-while-revalidate=600",
    );
    return response;
  } catch (err) {
    console.error("[GET /api/cards-overview]", err);
    return NextResponse.json(
      { error: "Failed to fetch cards overview data", details: String(err) },
      { status: 500 },
    );
  }
}
