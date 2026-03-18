import { NextResponse } from "next/server";
import {
  getAccountStatusDistribution,
  getDpdDistribution,
  getCreditLimitDistribution,
  getAccountGrowthTrend,
  getBalanceDistribution,
  getPortfolioSnapshot,
  getAccountStatusBreakdown,
  getCreditLimitBuckets,
} from "@/services/queries/portfolio-deep-dive";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate query params are required" },
        { status: 400 },
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const [
      accountStatusDistribution,
      dpdDistribution,
      creditLimitDistribution,
      accountGrowthTrend,
      balanceDistribution,
      snapshot,
      statusBreakdown,
      creditLimitDist,
    ] = await Promise.all([
      getAccountStatusDistribution(end),
      getDpdDistribution(end),
      getCreditLimitDistribution(end),
      getAccountGrowthTrend(start, end),
      getBalanceDistribution(end),
      getPortfolioSnapshot(start, end),
      getAccountStatusBreakdown(end),
      getCreditLimitBuckets(end),
    ]);

    return NextResponse.json({
      accountStatusDistribution,
      dpdDistribution,
      creditLimitDistribution,
      accountGrowthTrend,
      balanceDistribution,
      snapshot,
      statusBreakdown,
      creditLimitDist,
    });
  } catch (error) {
    console.error("[portfolio] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio data" },
      { status: 500 },
    );
  }
}
