import { NextResponse } from "next/server";
import {
  getPointsSummary,
  getPointsFlowTrend,
  getPointsClosingBalance,
  getRedemptionBreakdown,
} from "@/services/queries/points-program";

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
      pointsSummary,
      pointsFlowTrend,
      pointsClosingBalance,
      redemptionBreakdown,
    ] = await Promise.all([
      getPointsSummary(start, end),
      getPointsFlowTrend(start, end),
      getPointsClosingBalance(start, end),
      getRedemptionBreakdown(start, end),
    ]);

    return NextResponse.json({
      pointsSummary,
      pointsFlowTrend,
      pointsClosingBalance,
      redemptionBreakdown,
    });
  } catch (error) {
    console.error("[points-program] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch points program data" },
      { status: 500 },
    );
  }
}
