import { NextResponse } from "next/server";
import {
  getDelinquencyRateTrend,
  getDpdFlowRates,
  getDpdBalanceExposure,
  getWriteOffTrend,
  getCollectionsStatusBreakdown,
} from "@/services/queries/risk-deep-dive";

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
      delinquencyRateTrend,
      dpdFlowRates,
      dpdBalanceExposure,
      writeOffTrend,
      collectionsStatusBreakdown,
    ] = await Promise.all([
      getDelinquencyRateTrend(start, end),
      getDpdFlowRates(start, end),
      getDpdBalanceExposure(end),
      getWriteOffTrend(start, end),
      getCollectionsStatusBreakdown(end),
    ]);

    return NextResponse.json({
      delinquencyRateTrend,
      dpdFlowRates,
      dpdBalanceExposure,
      writeOffTrend,
      collectionsStatusBreakdown,
    });
  } catch (error) {
    console.error("[risk] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk data" },
      { status: 500 },
    );
  }
}
