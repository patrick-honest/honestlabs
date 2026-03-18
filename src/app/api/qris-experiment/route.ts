import { NextResponse } from "next/server";
import {
  getQrisCohortComparison,
  getQrisMerchantBreakdown,
  getQrisOnlyMerchantGrowthTrend,
  getMixedMerchantQrisStats,
  getInterchangeProjection,
  getQrisOnlyMerchantSpendTrend,
  getCohortFinancials,
  getCohortRpu,
} from "@/services/queries/qris-experiment";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "2026-02-09";

    const endDate = searchParams.get("endDate") || new Date().toISOString().slice(0, 10);

    const [cohortComparison, merchantBreakdown, merchantGrowth, mixedMerchantStats, interchangeProjection, qrisOnlyMerchantSpend, cohortFinancials, cohortRpu] =
      await Promise.all([
        getQrisCohortComparison(startDate),
        getQrisMerchantBreakdown(),
        getQrisOnlyMerchantGrowthTrend(),
        getMixedMerchantQrisStats(),
        getInterchangeProjection(startDate),
        getQrisOnlyMerchantSpendTrend(),
        getCohortFinancials(),
        getCohortRpu(startDate, endDate),
      ]);

    return NextResponse.json({ cohortComparison, merchantBreakdown, merchantGrowth, mixedMerchantStats, interchangeProjection, qrisOnlyMerchantSpend, cohortFinancials, cohortRpu });
  } catch (error) {
    console.error("[qris-experiment] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch QRIS experiment data" },
      { status: 500 },
    );
  }
}
