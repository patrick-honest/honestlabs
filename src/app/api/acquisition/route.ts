import { NextRequest, NextResponse } from "next/server";
import {
  getAcquisitionFunnel,
  getApprovalsByProduct,
  getDecisionBreakdown,
  getProductMix,
  getApprovalRateTrend,
} from "@/services/queries/acquisition";

// ---------------------------------------------------------------------------
// GET /api/acquisition?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//
// Returns acquisition funnel, decision breakdown, product mix, approval
// rate trend, and approval data from BigQuery.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "2025-10-01";
    const endDate = searchParams.get("endDate") || "2026-03-17";

    const start = new Date(startDate);
    const end = new Date(endDate);

    const [funnel, approvalsByProduct, decisionBreakdown, productMix, approvalRateTrend] = await Promise.all([
      getAcquisitionFunnel(start, end).catch(() => []),
      getApprovalsByProduct(start, end).catch(() => []),
      getDecisionBreakdown(start, end).catch(() => []),
      getProductMix(start, end).catch(() => []),
      getApprovalRateTrend(start, end).catch(() => []),
    ]);

    const response = NextResponse.json({
      funnel,
      approvalsByProduct,
      decisionBreakdown,
      productMix,
      approvalRateTrend,
      asOf: new Date().toISOString(),
      dataRange: { start: startDate, end: endDate },
    });

    response.headers.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=900, stale-while-revalidate=600",
    );
    return response;
  } catch (err) {
    console.error("[GET /api/acquisition]", err);
    return NextResponse.json(
      { error: "Failed to fetch acquisition data", details: String(err) },
      { status: 500 },
    );
  }
}
