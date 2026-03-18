import { NextResponse } from "next/server";
import {
  getWeeklyDpdDistribution,
  getDpdBalanceExposure,
} from "@/services/queries/risk-analysis";

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

    const [dpdTrend, balanceExposure] = await Promise.all([
      getWeeklyDpdDistribution(start, end),
      getDpdBalanceExposure(end),
    ]);

    return NextResponse.json({
      dpdTrend,
      balanceExposure,
    });
  } catch (error) {
    console.error("[risk] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk data" },
      { status: 500 },
    );
  }
}
