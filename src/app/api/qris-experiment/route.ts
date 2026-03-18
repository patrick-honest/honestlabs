import { NextResponse } from "next/server";
import {
  getQrisCohortComparison,
  getQrisMerchantBreakdown,
  getQrisOnlyMerchantGrowthTrend,
  getMixedMerchantQrisStats,
  getInterchangeProjection,
  getQrisOnlyMerchantSpendTrend,
  getCohortFinancials,
} from "@/services/queries/qris-experiment";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "2026-02-09";

    const [cohortComparison, merchantBreakdown, merchantGrowth, mixedMerchantStats, interchangeProjection, qrisOnlyMerchantSpend, cohortFinancials] =
      await Promise.all([
        getQrisCohortComparison(startDate),
        getQrisMerchantBreakdown(),
        getQrisOnlyMerchantGrowthTrend(),
        getMixedMerchantQrisStats(),
        getInterchangeProjection(startDate),
        getQrisOnlyMerchantSpendTrend(),
        getCohortFinancials(),
      ]);

    return NextResponse.json({ cohortComparison, merchantBreakdown, merchantGrowth, mixedMerchantStats, interchangeProjection, qrisOnlyMerchantSpend, cohortFinancials });
  } catch (error) {
    console.error("[qris-experiment] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch QRIS experiment data" },
      { status: 500 },
    );
  }
}
